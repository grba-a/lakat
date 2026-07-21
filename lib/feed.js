import { getCurrentDayStart } from "@/lib/day";

const NAJAVA_TRAJANJE_MS = 45 * 60 * 1000;
const SAZIV_ZIVOT_NAKON_MS = 3 * 60 * 60 * 1000;

// Današnji feed Šanka: checkini, pića, najave, sazivi + reakcije/odazivi/
// brojevi komentara keyani po ID-jevima. RLS scopa na mene + frendove.
// Jedini izvor istine za feed upite — koristi ga i server render (page.jsx)
// i klijentski foreground refetch (sank.jsx), pa se query oblik ne razilazi.
export async function fetchTodayFeed(supabase) {
  const dayStart = getCurrentDayStart();
  const najavaCutoff = new Date(Date.now() - NAJAVA_TRAJANJE_MS).toISOString();
  const sazivCutoff = new Date(Date.now() - SAZIV_ZIVOT_NAKON_MS).toISOString();

  const [
    { data: checkins },
    { data: drinks },
    { data: najave },
    { data: sazivi },
  ] = await Promise.all([
    supabase
      .from("checkins")
      .select("id, user_id, checked_in_at, cancelled_at, photo_url, thumb_url, lat, lng")
      .gte("checked_in_at", dayStart.toISOString())
      .order("checked_in_at", { ascending: true }),
    supabase
      .from("drinks")
      .select("id, user_id, drink_type, logged_at")
      .gte("logged_at", dayStart.toISOString()),
    supabase
      .from("najave")
      .select("id, user_id, created_at, target_user_id")
      .gte("created_at", najavaCutoff),
    supabase
      .from("sazivi")
      .select("id, created_by, place_text, at_time, created_at")
      .gte("at_time", sazivCutoff)
      .order("created_at", { ascending: false }),
  ]);

  // Odazivi + reakcije + brojevi komentara ovise o ID-jevima pa drugi val
  const sazivIds = (sazivi ?? []).map((s) => s.id);
  const checkinIds = (checkins ?? []).map((c) => c.id);
  const [{ data: odazivi }, { data: reactionRows }, { data: commentRows }] =
    await Promise.all([
      sazivIds.length
        ? supabase
            .from("saziv_odazivi")
            .select("user_id, saziv_id, status")
            .in("saziv_id", sazivIds)
        : Promise.resolve({ data: [] }),
      checkinIds.length
        ? supabase
            .from("reactions")
            .select("checkin_id, user_id, emoji")
            .in("checkin_id", checkinIds)
        : Promise.resolve({ data: [] }),
      checkinIds.length
        ? supabase
            .from("comments")
            .select("checkin_id")
            .in("checkin_id", checkinIds)
        : Promise.resolve({ data: [] }),
    ]);

  const reactions = {};
  for (const r of reactionRows ?? []) {
    (reactions[r.checkin_id] ??= []).push({
      user_id: r.user_id,
      emoji: r.emoji,
    });
  }
  const commentCounts = {};
  for (const c of commentRows ?? []) {
    commentCounts[c.checkin_id] = (commentCounts[c.checkin_id] ?? 0) + 1;
  }

  return {
    checkins: checkins ?? [],
    drinks: drinks ?? [],
    najave: najave ?? [],
    sazivi: sazivi ?? [],
    odazivi: odazivi ?? [],
    reactions,
    commentCounts,
  };
}
