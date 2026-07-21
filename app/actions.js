"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentDayStart, getDayKey } from "@/lib/day";
import { friendIdsOf } from "@/lib/friends";
import { notifyFriends, notifyUser } from "@/lib/push";
import {
  checkinPushBody,
  rundaPushBody,
  fomoPushBody,
  najavaTargetPushBody,
  commentPushBody,
  drinkMilestonePushBody,
  sazivPushBody,
  kadarPushBody,
} from "@/lib/push-copy";
import { distanceM, KADAR_RADIUS_M } from "@/lib/geo";
import { evaluateBadges } from "@/lib/badges";
import { drinkInfo } from "@/lib/drinks";

const FOMO_MIN_PRESENT = 3;
// Ne-prve runde šalju push, ali max 1× po autoru unutar ovog prozora —
// da aktivna večer ne pretvori frendove u notifikacijski vodopad
const RUNDA_PUSH_COOLDOWN_MS = 45 * 60 * 1000;

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// FOMO 3.0: kad netko sjedne, njegovi frendovi koji NISU vani a sad imaju
// FOMO_MIN_PRESENT+ frendova vani dobiju push — max 1× dnevno po
// primatelju (claim preko profiles.fomo_day, isti obrazac kao nekad
// groups.fomo_day — atomičan update spriječi duple pusheve)
async function fomoSweep(authorId) {
  const admin = createAdminClient();
  const dayStartIso = getCurrentDayStart().toISOString();
  const todayKey = getDayKey(new Date());

  // samo autorovi frendovi su mogli "dobiti trećeg" ovim checkinom
  const friends = await friendIdsOf(admin, authorId);
  if (!friends.length) return;

  const { data: outRows } = await admin
    .from("checkins")
    .select("user_id")
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStartIso);
  const out = new Set((outRows ?? []).map((r) => r.user_id));

  const kandidati = friends.filter((f) => !out.has(f));
  if (!kandidati.length) return;

  // frendstva svih kandidata jednim upitom
  const orExpr = kandidati
    .map((id) => `requester.eq.${id},addressee.eq.${id}`)
    .join(",");
  const { data: kfr } = await admin
    .from("friendships")
    .select("requester, addressee")
    .eq("status", "accepted")
    .or(orExpr);

  const kandidatSet = new Set(kandidati);
  const countOut = new Map();
  for (const r of kfr ?? []) {
    for (const [me, other] of [
      [r.requester, r.addressee],
      [r.addressee, r.requester],
    ]) {
      if (kandidatSet.has(me) && out.has(other)) {
        countOut.set(me, (countOut.get(me) ?? 0) + 1);
      }
    }
  }

  for (const [uid, n] of countOut) {
    if (n < FOMO_MIN_PRESENT) continue;
    const { data: claimed } = await admin
      .from("profiles")
      .update({ fomo_day: todayKey })
      .eq("id", uid)
      .or(`fomo_day.is.null,fomo_day.neq.${todayKey}`)
      .select("id");
    if (claimed?.length) {
      await notifyUser({ userId: uid, body: fomoPushBody(n) });
    }
  }
}

export async function checkIn(photoUrl, thumbUrl, coords, kadarIds) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Slika (i thumb) smije biti samo iz vlastite mape u dokazi bucketu —
  // sve drugo se tiho odbacuje (nitko ne podmeće tuđe/vanjske URL-ove)
  const dokaziPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dokazi/${user.id}/`;
  let photo_url = null;
  if (typeof photoUrl === "string" && photoUrl.startsWith(dokaziPrefix)) {
    photo_url = photoUrl;
  }
  // Slika je OBAVEZNA — bez valjanog dokaza nema runde (i UI to sprječava)
  if (!photo_url) {
    return { error: "Bez slike nema šanka. Slikaj pa objavi." };
  }
  let thumb_url = null;
  if (photo_url && typeof thumbUrl === "string" && thumbUrl.startsWith(dokaziPrefix)) {
    thumb_url = thumbUrl;
  }

  // Lokacija je opcionalna; prihvaćaju se samo smislene koordinate
  let lat = null;
  let lng = null;
  if (
    typeof coords?.lat === "number" &&
    typeof coords?.lng === "number" &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    Math.abs(coords.lat) <= 90 &&
    Math.abs(coords.lng) <= 180
  ) {
    lat = coords.lat;
    lng = coords.lng;
  }

  const dayStart = getCurrentDayStart();

  // Više rundi dnevno je dozvoljeno; prva runda dana je "check-in", ostale
  // šalju push uz cooldown po autoru (zato treba i VRIJEME prethodne runde)
  const { data: existing, error: checkError } = await supabase
    .from("checkins")
    .select("checked_in_at")
    .eq("user_id", user.id)
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStart.toISOString())
    .order("checked_in_at", { ascending: false })
    .limit(1);

  if (checkError) {
    return { error: `Nešto je puklo: ${checkError.message}` };
  }
  const isFirstToday = !existing?.length;
  const prevRundaAt = existing?.[0]?.checked_in_at ?? null;

  // Runda u prozoru živog VIDLJIVOG saziva (moj ili frendov — RLS filtrira)
  // se veže na njega; prozor = sat prije at_time do 3h nakon
  let saziv_id = null;
  try {
    const zivi = await fetchZiviSaziv(supabase);
    if (
      zivi &&
      Date.now() >= new Date(zivi.at_time).getTime() - SAZIV_RANIJE_MS
    ) {
      saziv_id = zivi.id;
    }
  } catch {
    // saziv je bonus — runda ide dalje i bez njega
  }

  // Zajednički kadar: tagirani moraju biti MOJI FRENDOVI i fizički blizu
  // (server ne vjeruje klijentu). STROGO lokacijski: bez autorovih
  // koordinata kadar se odbacuje.
  let kadar_user_ids = null;
  if (photo_url && lat != null && lng != null && Array.isArray(kadarIds) && kadarIds.length) {
    const candidates = [
      ...new Set(kadarIds.filter((x) => typeof x === "string" && x !== user.id)),
    ].slice(0, 20);
    if (candidates.length) {
      try {
        const friendIds = await friendIdsOf(supabase, user.id);
        const frendovi = candidates.filter((id) => friendIds.includes(id));
        if (frendovi.length) {
          const { data: tudjeRunde } = await supabase
            .from("checkins")
            .select("user_id, lat, lng")
            .is("cancelled_at", null)
            .in("user_id", frendovi)
            .not("lat", "is", null)
            .not("lng", "is", null)
            .gte("checked_in_at", dayStart.toISOString())
            .order("checked_in_at", { ascending: false });
          // redovi su desc — prvi po korisniku je njegova najnovija runda
          const seen = new Set();
          const blizu = [];
          for (const r of tudjeRunde ?? []) {
            if (seen.has(r.user_id)) continue;
            seen.add(r.user_id);
            if (distanceM({ lat, lng }, r) <= KADAR_RADIUS_M) blizu.push(r.user_id);
          }
          if (blizu.length) kadar_user_ids = [user.id, ...blizu];
        }
      } catch {
        // provjera je best-effort — bez nje kadar se (strogo) odbacuje
      }
    }
  }

  // Partner kafić: runda unutar radijusa kafića dobiva kafic_id (temelj
  // budućih bodova vjernosti — UI skriven do prvog ugovora)
  let kafic_id = null;
  if (lat != null && lng != null) {
    try {
      const { data: kafici } = await supabase
        .from("kafici")
        .select("id, lat, lng, radius_m");
      let best = null;
      for (const k of kafici ?? []) {
        const d = distanceM({ lat, lng }, k);
        if (d <= k.radius_m && (!best || d < best.d)) best = { id: k.id, d };
      }
      kafic_id = best?.id ?? null;
    } catch {
      // kafić je bonus
    }
  }

  const checkedInAt = new Date().toISOString();
  const row = { user_id: user.id, photo_url, thumb_url, lat, lng };
  if (saziv_id) row.saziv_id = saziv_id;
  if (kadar_user_ids) row.kadar_user_ids = kadar_user_ids;
  if (kafic_id) row.kafic_id = kafic_id;
  const { data: inserted, error } = await supabase
    .from("checkins")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: `Checkin nije prošao: ${error.message}` };
  }
  const insertedId = inserted?.id ?? null;

  // Bedževi — awaita se (toast treba rezultat odmah), ali greška ovdje
  // ne smije srušiti checkin: default na prazan popis
  let newBadges = [];
  try {
    newBadges = await evaluateBadges({
      admin: createAdminClient(),
      userId: user.id,
      trigger: "checkin",
      context: { checkedInAt },
    });
  } catch {
    // ignoriraj: checkin je prošao, bedževi su bonus
  }

  // Kadar kopija "laktaju skupa" — imena tagiranih (frendovi su mi, RLS ih pušta)
  let kadarBody = null;
  if (kadar_user_ids) {
    try {
      const { data: profili } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", kadar_user_ids);
      const imena = kadar_user_ids
        .map((id) => profili?.find((p) => p.id === id)?.username)
        .filter(Boolean);
      if (imena.length >= 2) kadarBody = kadarPushBody(imena);
    } catch {
      // fallback na običnu kopiju
    }
  }

  // Push MOJIM FRENDOVIMA — prva runda dana šalje uvijek (kadar kopija ima
  // prednost); ostale runde šalju rundaPushBody uz cooldown po autoru, a
  // kadar kopija se koristi samo za prvu autorovu kadar sliku dana.
  if (!isFirstToday) {
    if (
      prevRundaAt &&
      Date.now() - new Date(prevRundaAt).getTime() < RUNDA_PUSH_COOLDOWN_MS
    ) {
      return { ok: true, newBadges };
    }
    try {
      let body = null;
      const excludeIds = kadar_user_ids ?? [];
      if (kadarBody && insertedId) {
        const { count } = await supabase
          .from("checkins")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("cancelled_at", null)
          .not("kadar_user_ids", "is", null)
          .gte("checked_in_at", dayStart.toISOString())
          .neq("id", insertedId);
        if ((count ?? 0) === 0) body = kadarBody;
      }
      if (!body) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        body = rundaPushBody(profile?.username ?? "Netko");
      }
      await notifyFriends({ userId: user.id, excludeIds, body });
    } catch {
      // best-effort
    }
    return { ok: true, newBadges };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    await notifyFriends({
      userId: user.id,
      excludeIds: kadarBody ? kadar_user_ids : [],
      body: kadarBody ?? checkinPushBody(profile?.username ?? "Netko"),
    });

    await fomoSweep(user.id);
  } catch {
    // ignoriraj: checkin je prošao, obavijesti su best-effort
  }

  return { ok: true, newBadges };
}

const REACTION_EMOJI = ["🔥", "🤮", "😂", "🫡", "🍺"];

// Reakcija na sliku: ista = makni (toggle), druga = pregazi
export async function react(checkinId, emoji) {
  if (!REACTION_EMOJI.includes(emoji)) {
    return { error: "Taj emoji ne postoji u ponudi, hakeru." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS pušta samo slike frendova — ovo je ujedno i provjera vidljivosti
  const { data: checkin } = await supabase
    .from("checkins")
    .select("id")
    .eq("id", checkinId)
    .maybeSingle();
  if (!checkin) {
    return { error: "Ta slika ne postoji ili nije od tvog pajdaša." };
  }

  const { data: existing } = await supabase
    .from("reactions")
    .select("id, emoji")
    .eq("checkin_id", checkinId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.emoji === emoji) {
    const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
    if (error) return { error: `Nije prošlo: ${error.message}` };
    return { ok: true, removed: true };
  }

  const { error } = await supabase
    .from("reactions")
    .upsert(
      { checkin_id: checkinId, user_id: user.id, emoji },
      { onConflict: "checkin_id,user_id" }
    );
  if (error) return { error: `Nije prošlo: ${error.message}` };
  return { ok: true };
}

const COMMENT_MAX_LEN = 200;

// Komentar na check-in — jedan redak, samo autor briše
export async function addComment(checkinId, text) {
  const trimmed = text?.toString().trim() ?? "";
  if (!trimmed) {
    return { error: "Prazan komentar? Ma daj." };
  }
  if (trimmed.length > COMMENT_MAX_LEN) {
    return { error: `Malo si se raspisao. Max ${COMMENT_MAX_LEN} znakova.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: checkin } = await supabase
    .from("checkins")
    .select("id, user_id")
    .eq("id", checkinId)
    .maybeSingle();
  if (!checkin) {
    return { error: "Ta slika ne postoji ili nije od tvog pajdaša." };
  }

  const { error } = await supabase.from("comments").insert({
    checkin_id: checkinId,
    user_id: user.id,
    text: trimmed,
  });
  if (error) return { error: `Nije prošlo: ${error.message}` };

  // Push vlasniku check-ina — ne sebi, i ne smije srušiti komentar ako pukne
  if (checkin.user_id !== user.id) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      await notifyUser({
        userId: checkin.user_id,
        body: commentPushBody(profile?.username ?? "Netko", trimmed),
      });
    } catch {
      // best-effort
    }
  }

  let newBadges = [];
  try {
    newBadges = await evaluateBadges({
      admin: createAdminClient(),
      userId: user.id,
      trigger: "comment",
    });
  } catch {
    // ignoriraj: komentar je prošao, bedževi su bonus
  }

  return { ok: true, newBadges };
}

export async function deleteComment(commentId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);
  if (error) return { error: `Nije prošlo: ${error.message}` };
  return { ok: true };
}

const NAJAVA_TRAJANJE_MS = 45 * 60 * 1000;

// "Stižem" — najava dolaska KOD konkretnog prisutnog FRENDA (klik na
// njegovu karticu/avatar). Push ide SAMO meti; istekne za 45 min.
export async function najaviDolazak(targetUserId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!targetUserId || targetUserId === user.id) {
    return { error: "Kod koga točno stižeš?" };
  }

  const dayStart = getCurrentDayStart();

  const { data: active } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStart.toISOString())
    .limit(1);
  if (active?.length) {
    return { error: "Već si za šankom, kamo točno stižeš?" };
  }

  // Meta mora biti za šankom — RLS pušta samo frendove pa je ovo ujedno
  // i provjera frendstva (ne-frendov checkin je nevidljiv)
  const { data: targetActive } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", targetUserId)
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStart.toISOString())
    .limit(1);
  if (!targetActive?.length) {
    return { error: "Taj više nije za šankom. Zakasnio si." };
  }

  const since = new Date(Date.now() - NAJAVA_TRAJANJE_MS).toISOString();
  const { data: recent } = await supabase
    .from("najave")
    .select("id")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .limit(1);
  if (recent?.length) {
    return { already: true };
  }

  const { error } = await supabase
    .from("najave")
    .insert({ user_id: user.id, target_user_id: targetUserId });
  if (error) {
    return { error: `Najava nije prošla: ${error.message}` };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    await notifyUser({
      userId: targetUserId,
      body: najavaTargetPushBody(profile?.username ?? "Netko"),
    });
  } catch {
    // najava je prošla, push je best-effort
  }

  return { ok: true };
}

const DRINK_LOG_COOLDOWN_MS = 45 * 1000;

// Logiranje pića — samo dok si aktivno checkiran; redni broj se ne
// sprema, derivira se brojanjem redova
export async function logDrink(drinkType) {
  if (!drinkInfo(drinkType)) {
    return { error: "To piće ne postoji, hakeru." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dayStart = getCurrentDayStart();

  const { data: activeCheckin } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStart.toISOString())
    .limit(1);
  if (!activeCheckin?.length) {
    return { error: "Prvo sjedni za šank, pa onda cugaj. Redoslijed, pička ti materina." };
  }

  const { data: mine } = await supabase
    .from("drinks")
    .select("id, logged_at")
    .eq("user_id", user.id)
    .gte("logged_at", dayStart.toISOString())
    .order("logged_at", { ascending: false })
    .limit(1);
  if (mine?.length && Date.now() - new Date(mine[0].logged_at).getTime() < DRINK_LOG_COOLDOWN_MS) {
    return { error: "Polako, majstore. Ni Bukowski nije pio tako brzo." };
  }

  const { error } = await supabase
    .from("drinks")
    .insert({ user_id: user.id, drink_type: drinkType });
  if (error) {
    return { error: `Nije prošlo: ${error.message}` };
  }

  const { count } = await supabase
    .from("drinks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("logged_at", dayStart.toISOString());
  const tonightCount = count ?? 0;

  let newBadges = [];
  try {
    newBadges = await evaluateBadges({
      admin: createAdminClient(),
      userId: user.id,
      trigger: "drink",
      context: { tonightCount },
    });
  } catch {
    // ignoriraj: piće je prošlo, bedževi su bonus
  }

  // Milestone push SAMO na točno deseto piće — volumen notifikacija nizak
  if (tonightCount === 10) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      await notifyFriends({
        userId: user.id,
        body: drinkMilestonePushBody(profile?.username ?? "Netko"),
      });
    } catch {
      // best-effort
    }
  }

  return { ok: true, count: tonightCount, newBadges };
}

// ── Saziv "Poziv na laktanje" ──────────────────────────────────────────
// 3.0: saziv ide SVIM frendovima kreatora; max JEDAN živi saziv PO
// KREATORU (od kreiranja do at_time + 3h). Nema crona — istek se
// filtrira timestampom.

const SAZIV_ZIVOT_NAKON_MS = 3 * 60 * 60 * 1000;
const SAZIV_RANIJE_MS = 60 * 60 * 1000;
const SAZIV_MAX_UNAPRIJED_MS = 24 * 60 * 60 * 1000;
const SAZIV_MJESTO_MAX = 40;

const sazivTimeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

// Najnoviji živi saziv: bez filtera = najnoviji VIDLJIVI (moj ili
// frendov, RLS filtrira); s createdBy = samo moj (guard za digniEkipu)
async function fetchZiviSaziv(supabase, createdBy = null) {
  const cutoff = new Date(Date.now() - SAZIV_ZIVOT_NAKON_MS).toISOString();
  let query = supabase
    .from("sazivi")
    .select("id, created_by, place_text, at_time, created_at")
    .gte("at_time", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);
  if (createdBy) query = query.eq("created_by", createdBy);
  const { data } = await query;
  return data?.[0] ?? null;
}

export async function digniEkipu(placeText, atTimeIso) {
  const mjesto = placeText?.toString().trim() ?? "";
  if (!mjesto) {
    return { error: "Gdje se dižete? Mjesto, majstore." };
  }
  if (mjesto.length > SAZIV_MJESTO_MAX) {
    return { error: `Kraće. Max ${SAZIV_MJESTO_MAX} znakova, ne roman.` };
  }

  const atTime = new Date(atTimeIso ?? "");
  if (Number.isNaN(atTime.getTime())) {
    return { error: "To vrijeme ne postoji." };
  }
  if (atTime.getTime() < Date.now() - 5 * 60 * 1000) {
    return { error: "To je prošlo. Vremeplov još ne radi." };
  }
  if (atTime.getTime() > Date.now() + SAZIV_MAX_UNAPRIJED_MS) {
    return { error: "Max 24 sata unaprijed. Ne planiramo godišnji." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const postojeci = await fetchZiviSaziv(supabase, user.id);
  if (postojeci) {
    return { error: "Već imaš živi poziv. Spusti ga pa digni novi." };
  }

  const { data: inserted, error } = await supabase
    .from("sazivi")
    .insert({
      created_by: user.id,
      place_text: mjesto,
      at_time: atTime.toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: `Poziv nije prošao: ${error.message}` };
  }

  // Tko diže, taj i stiže — auto odaziv (greška ne ruši saziv)
  if (inserted?.id) {
    await supabase.from("saziv_odazivi").insert({
      saziv_id: inserted.id,
      user_id: user.id,
      status: "stizem",
    });
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    const jeSad = atTime.getTime() - Date.now() < 10 * 60 * 1000;
    await notifyFriends({
      userId: user.id,
      body: sazivPushBody(
        profile?.username ?? "Netko",
        mjesto,
        jeSad ? null : sazivTimeFmt.format(atTime)
      ),
    });
  } catch {
    // saziv je prošao, push je best-effort
  }

  return { ok: true, sazivId: inserted?.id ?? null };
}

// Odaziv na saziv: stizem / ne_mogu; ponovni tap mijenja status (upsert)
export async function odazoviSe(sazivId, status) {
  if (!["stizem", "ne_mogu"].includes(status)) {
    return { error: "Stižeš ili ne stižeš. Trećeg nema." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS pušta samo sazive frendova — ujedno provjera vidljivosti
  const { data: saziv } = await supabase
    .from("sazivi")
    .select("id, at_time")
    .eq("id", sazivId)
    .maybeSingle();
  if (!saziv) {
    return { error: "Taj poziv ne postoji ili nije od tvog pajdaša." };
  }
  if (new Date(saziv.at_time).getTime() + SAZIV_ZIVOT_NAKON_MS < Date.now()) {
    return { error: "Taj poziv je istekao. Prekasno, kao i obično." };
  }

  const { error } = await supabase
    .from("saziv_odazivi")
    .upsert(
      {
        saziv_id: saziv.id,
        user_id: user.id,
        status,
        responded_at: new Date().toISOString(),
      },
      { onConflict: "saziv_id,user_id" }
    );
  if (error) {
    return { error: `Nije prošlo: ${error.message}` };
  }
  return { ok: true };
}

// Otkazivanje — samo tko je digao može spustiti (cascade briše odazive)
export async function otkaziSaziv(sazivId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("sazivi")
    .delete()
    .eq("id", sazivId)
    .eq("created_by", user.id);
  if (error) {
    return { error: `Nije prošlo: ${error.message}` };
  }
  return { ok: true };
}

// Krivi tap — briše zadnje logirano piće večeras (samo svoje)
export async function undoLastDrink() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dayStart = getCurrentDayStart();
  const { data: rows, error: findError } = await supabase
    .from("drinks")
    .select("id")
    .eq("user_id", user.id)
    .gte("logged_at", dayStart.toISOString())
    .order("logged_at", { ascending: false })
    .limit(1);
  if (findError) {
    return { error: `Nešto je puklo: ${findError.message}` };
  }
  if (!rows?.length) {
    return { error: "Nemaš što brisati. Trijezan ko sudac." };
  }

  const { error } = await supabase.from("drinks").delete().eq("id", rows[0].id);
  if (error) {
    return { error: `Nije prošlo: ${error.message}` };
  }
  return { ok: true };
}
