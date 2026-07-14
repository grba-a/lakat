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
  najavaPushBody,
  commentPushBody,
  drinkMilestonePushBody,
} from "@/lib/push-copy";
import { evaluateBadges } from "@/lib/badges";
import { DRINK_TYPES, drinkInfo } from "@/lib/drinks";

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

  // Dupli AKTIVNI checkin u istom danu (u ovoj grupi) blokiramo i na
  // serveru; nakon poništenja se smiješ vratiti (novi red)
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
  if (existing?.length) {
    return { already: true };
  }

  const checkedInAt = new Date().toISOString();
  const { error } = await supabase
    .from("checkins")
    .insert({ user_id: user.id, group_id: active.id, photo_url, thumb_url, lat, lng });
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

  // Push ostalima iz grupe — ne smije srušiti checkin ako slanje pukne
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

// "Stižem." — najava dolaska, push ekipi, istekne za 45 min
export async function najaviDolazak() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
    .insert({ user_id: user.id, group_id: grupa.id });
  if (error) {
    return { error: `Najava nije prošla: ${error.message}` };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    await notifyGroup({
      groupId: grupa.id,
      groupName: grupa.name,
      senderId: user.id,
      body: najavaPushBody(profile?.username ?? "Netko"),
    });
  } catch {
    // najava je prošla, push je best-effort
  }

  return { ok: true };
}

export async function cancelCheckIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveGroup(supabase, user.id);
  if (!active) {
    return { error: "Nisi ni u jednoj grupi. Od čega bježiš?" };
  }

  const dayStart = getCurrentDayStart();

  const { data: rows, error: findError } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", active.id)
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStart.toISOString())
    .order("checked_in_at", { ascending: false })
    .limit(1);

  if (findError) {
    return { error: `Nešto je puklo: ${findError.message}` };
  }
  if (!rows?.length) {
    return { error: "Nemaš aktivan check-in. Od čega bježiš?" };
  }

  const { error } = await supabase
    .from("checkins")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", rows[0].id);

  if (error) {
    return { error: `Poništavanje nije prošlo: ${error.message}` };
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

// Kolo pića ("Piće dana") — rezultat bira ISKLJUČIVO server (anti-cheat);
// strogo 1 spin dnevno PO KORISNIKU (bez obzira na grupu), bez check-in
// uvjeta — ikona živi u headeru i vrti se i prije dolaska
export async function spinKolo() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveGroup(supabase, user.id);
  if (!active) {
    return { error: "Nisi ni u jednoj grupi. Gdje bi to pio?" };
  }

  const dayStart = getCurrentDayStart();

  const { data: already } = await supabase
    .from("kolo_spins")
    .select("id, result")
    .eq("user_id", user.id)
    .gte("created_at", dayStart.toISOString())
    .limit(1);
  if (already?.length) {
    return { error: "Kolo je presudilo. Nema žalbe.", already: true, result: already[0].result };
  }

  const result = DRINK_TYPES[Math.floor(Math.random() * DRINK_TYPES.length)].key;

  const admin = createAdminClient();
  const { error } = await admin
    .from("kolo_spins")
    .insert({ user_id: user.id, group_id: active.id, result });
  if (error) {
    return { error: `Kolo je zapelo: ${error.message}` };
  }

  // Namjerno bez pusha: rezultat kola vide svi na Šanku (realtime), a
  // notifikacija po svakom spinu je gnjavila — odluka korisnika
  return { ok: true, result };
}
