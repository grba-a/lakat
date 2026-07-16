"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentDayStart, getDayKey } from "@/lib/day";
import { getActiveGroup, getMyGroups } from "@/lib/groups";
import { notifyGroup, notifyUser } from "@/lib/push";
import {
  checkinPushBody,
  fomoPushBody,
  najavaTargetPushBody,
  commentPushBody,
  drinkMilestonePushBody,
  sazivPushBody,
} from "@/lib/push-copy";
import { evaluateBadges } from "@/lib/badges";
import { drinkInfo } from "@/lib/drinks";

const FOMO_MIN_PRESENT = 3;

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Prebacivanje aktivne grupe (dropdown na Šanku) — samo u grupu u kojoj
// si stvarno član
export async function switchGroup(groupId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const groups = await getMyGroups(supabase, user.id);
  if (!groups.some((g) => g.id === groupId)) {
    return { error: "Nisi u toj grupi. Lijepo probaj." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active_group_id: groupId })
    .eq("id", user.id);
  if (error) {
    return { error: `Prebacivanje nije prošlo: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function checkIn(photoUrl, thumbUrl, coords) {
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

  const { active } = await getActiveGroup(supabase, user.id);
  if (!active) {
    return { error: "Nisi ni u jednoj grupi. Kako si uopće ovdje?" };
  }

  const dayStart = getCurrentDayStart();

  // Više rundi dnevno je dozvoljeno (svaka runda = nova slika + piće);
  // prva runda dana je "check-in" i jedina šalje push grupi
  const { data: existing, error: checkError } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", active.id)
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStart.toISOString())
    .limit(1);

  if (checkError) {
    return { error: `Nešto je puklo: ${checkError.message}` };
  }
  const isFirstToday = !existing?.length;

  // Runda nastala u prozoru živog saziva se veže na njega (pouzdanost +
  // liga bodovi kasnije); prozor = sat prije at_time do 3h nakon
  let saziv_id = null;
  try {
    const zivi = await fetchZiviSaziv(supabase, active.id);
    if (
      zivi &&
      Date.now() >= new Date(zivi.at_time).getTime() - SAZIV_RANIJE_MS
    ) {
      saziv_id = zivi.id;
    }
  } catch {
    // saziv je bonus — runda ide dalje i bez njega
  }

  // saziv_id ide u insert samo kad postoji — runda ne smije ovisiti o
  // tome je li saziv schema već primijenjena
  const checkedInAt = new Date().toISOString();
  const row = { user_id: user.id, group_id: active.id, photo_url, thumb_url, lat, lng };
  if (saziv_id) row.saziv_id = saziv_id;
  const { error } = await supabase.from("checkins").insert(row);
  if (error) {
    return { error: `Checkin nije prošao: ${error.message}` };
  }

  // Bedževi — awaita se (toast treba rezultat odmah), ali greška ovdje
  // ne smije srušiti checkin: default na prazan popis
  let newBadges = [];
  try {
    newBadges = await evaluateBadges({
      admin: createAdminClient(),
      userId: user.id,
      groupId: active.id,
      trigger: "checkin",
      context: { checkedInAt },
    });
  } catch {
    // ignoriraj: checkin je prošao, bedževi su bonus
  }

  // Push ostalima iz grupe — SAMO za prvu rundu dana (svaka sljedeća
  // slika bi spamala grupu); ne smije srušiti checkin ako slanje pukne
  if (!isFirstToday) {
    return { ok: true, newBadges };
  }
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    await notifyGroup({
      groupId: active.id,
      groupName: active.name,
      senderId: user.id,
      body: checkinPushBody(profile?.username ?? "Netko"),
    });

    // FOMO: kad treći različiti član danas dođe, pingaj one koji fale —
    // jednom po danu po grupi (fomo_day claim spriječi dupli ping kod
    // ponovnog check-ina nakon poništenja i race dva istovremena checkina)
    const { data: todays } = await supabase
      .from("checkins")
      .select("user_id")
      .eq("group_id", active.id)
      .is("cancelled_at", null)
      .gte("checked_in_at", dayStart.toISOString());
    const present = [...new Set((todays ?? []).map((t) => t.user_id))];
    if (present.length >= FOMO_MIN_PRESENT) {
      const todayKey = getDayKey(new Date());
      const admin = createAdminClient();
      const { data: claimed } = await admin
        .from("groups")
        .update({ fomo_day: todayKey })
        .eq("id", active.id)
        .or(`fomo_day.is.null,fomo_day.neq.${todayKey}`)
        .select("id");
      if (claimed?.length) {
        await notifyGroup({
          groupId: active.id,
          groupName: active.name,
          senderId: user.id,
          excludeIds: present,
          body: fomoPushBody(present.length),
        });
      }
    }
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

  // Grupa reakcije = grupa slike na koju se reagira (RLS pušta samo
  // slike iz vlastitih grupa, pa je ovo ujedno i provjera članstva)
  const { data: checkin } = await supabase
    .from("checkins")
    .select("group_id")
    .eq("id", checkinId)
    .maybeSingle();
  if (!checkin) {
    return { error: "Ta slika ne postoji ili nije iz tvoje grupe." };
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
      { checkin_id: checkinId, user_id: user.id, group_id: checkin.group_id, emoji },
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
    .select("group_id, user_id")
    .eq("id", checkinId)
    .maybeSingle();
  if (!checkin) {
    return { error: "Ta slika ne postoji ili nije iz tvoje grupe." };
  }

  const { error } = await supabase
    .from("comments")
    .insert({
      checkin_id: checkinId,
      user_id: user.id,
      group_id: checkin.group_id,
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
      groupId: checkin.group_id,
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

// "Stižem" — najava dolaska KOD konkretnog prisutnog (klik na njegovu
// karticu). Push ide SAMO meti, ostali vide label u appu; istekne za 45 min.
export async function najaviDolazak(targetUserId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!targetUserId || targetUserId === user.id) {
    return { error: "Kod koga točno stižeš?" };
  }

  const { active: grupa } = await getActiveGroup(supabase, user.id);
  if (!grupa) {
    return { error: "Nisi ni u jednoj grupi. Kamo točno stižeš?" };
  }

  const dayStart = getCurrentDayStart();

  const { data: active } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", grupa.id)
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStart.toISOString())
    .limit(1);
  if (active?.length) {
    return { error: "Već si za šankom, kamo točno stižeš?" };
  }

  // Meta mora biti za šankom — stiže se KOD nekoga, ne u prazno
  const { data: targetActive } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", targetUserId)
    .eq("group_id", grupa.id)
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
    .eq("group_id", grupa.id)
    .gte("created_at", since)
    .limit(1);
  if (recent?.length) {
    return { already: true };
  }

  const { error } = await supabase
    .from("najave")
    .insert({ user_id: user.id, group_id: grupa.id, target_user_id: targetUserId });
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

// Logiranje pića — samo dok si aktivno checkiran (brojač živi na Šanku uz
// prisutne); redni broj se ne sprema, derivira se brojanjem redova
export async function logDrink(drinkType) {
  if (!drinkInfo(drinkType)) {
    return { error: "To piće ne postoji, hakeru." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveGroup(supabase, user.id);
  if (!active) {
    return { error: "Nisi ni u jednoj grupi. Gdje točno piješ?" };
  }

  const dayStart = getCurrentDayStart();

  const { data: activeCheckin } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", active.id)
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
    .eq("group_id", active.id)
    .gte("logged_at", dayStart.toISOString())
    .order("logged_at", { ascending: false })
    .limit(1);
  if (mine?.length && Date.now() - new Date(mine[0].logged_at).getTime() < DRINK_LOG_COOLDOWN_MS) {
    return { error: "Polako, majstore. Ni Bukowski nije pio tako brzo." };
  }

  const { error } = await supabase
    .from("drinks")
    .insert({ user_id: user.id, group_id: active.id, drink_type: drinkType });
  if (error) {
    return { error: `Nije prošlo: ${error.message}` };
  }

  const { count } = await supabase
    .from("drinks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("group_id", active.id)
    .gte("logged_at", dayStart.toISOString());
  const tonightCount = count ?? 0;

  let newBadges = [];
  try {
    newBadges = await evaluateBadges({
      admin: createAdminClient(),
      userId: user.id,
      groupId: active.id,
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
      await notifyGroup({
        groupId: active.id,
        groupName: active.name,
        senderId: user.id,
        body: drinkMilestonePushBody(profile?.username ?? "Netko"),
      });
    } catch {
      // best-effort
    }
  }

  return { ok: true, count: tonightCount, newBadges };
}

// ── Saziv "Dižem ekipu" ────────────────────────────────────────────────
// Jedan živi saziv po grupi: od kreiranja do at_time + 3h. Nema crona —
// istek se filtrira timestampom (isti obrazac kao najave).

const SAZIV_ZIVOT_NAKON_MS = 3 * 60 * 60 * 1000;
const SAZIV_RANIJE_MS = 60 * 60 * 1000;
const SAZIV_MAX_UNAPRIJED_MS = 24 * 60 * 60 * 1000;
const SAZIV_MJESTO_MAX = 40;

const sazivTimeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

async function fetchZiviSaziv(supabase, groupId) {
  const cutoff = new Date(Date.now() - SAZIV_ZIVOT_NAKON_MS).toISOString();
  const { data } = await supabase
    .from("sazivi")
    .select("id, created_by, place_text, at_time, created_at")
    .eq("group_id", groupId)
    .gte("at_time", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);
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

  const { active } = await getActiveGroup(supabase, user.id);
  if (!active) {
    return { error: "Nisi ni u jednoj grupi. Koga točno dižeš?" };
  }

  const postojeci = await fetchZiviSaziv(supabase, active.id);
  if (postojeci) {
    return { error: "Saziv već postoji. Odazovi se na njega." };
  }

  const { data: inserted, error } = await supabase
    .from("sazivi")
    .insert({
      group_id: active.id,
      created_by: user.id,
      place_text: mjesto,
      at_time: atTime.toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: `Saziv nije prošao: ${error.message}` };
  }

  // Tko diže, taj i stiže — auto odaziv (greška ne ruši saziv, builder
  // nikad ne baca nego vraća {error} koji ovdje svjesno ignoriramo)
  if (inserted?.id) {
    await supabase.from("saziv_odazivi").insert({
      saziv_id: inserted.id,
      user_id: user.id,
      group_id: active.id,
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
    await notifyGroup({
      groupId: active.id,
      groupName: active.name,
      senderId: user.id,
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

  // RLS pušta samo sazive vlastitih grupa — ovo je ujedno provjera članstva
  const { data: saziv } = await supabase
    .from("sazivi")
    .select("id, group_id, at_time")
    .eq("id", sazivId)
    .maybeSingle();
  if (!saziv) {
    return { error: "Taj saziv ne postoji ili nije iz tvoje grupe." };
  }
  if (new Date(saziv.at_time).getTime() + SAZIV_ZIVOT_NAKON_MS < Date.now()) {
    return { error: "Taj saziv je istekao. Prekasno, kao i obično." };
  }

  const { error } = await supabase
    .from("saziv_odazivi")
    .upsert(
      {
        saziv_id: saziv.id,
        user_id: user.id,
        group_id: saziv.group_id,
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

  const { active } = await getActiveGroup(supabase, user.id);
  if (!active) {
    return { error: "Nisi ni u jednoj grupi." };
  }

  const dayStart = getCurrentDayStart();
  const { data: rows, error: findError } = await supabase
    .from("drinks")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", active.id)
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
