// Ispod 30 minuta boravka poništeni checkin ne vrijedi (slučajni klik,
// "došao pa pobjegao"); tko je izdržao 30+ minuta pa pobjegao, taj se broji.
const MIN_STAY_MS = 30 * 60 * 1000;

export function countsForStats(checkin) {
  if (!checkin.cancelled_at) return true;
  return (
    new Date(checkin.cancelled_at) - new Date(checkin.checked_in_at) >=
    MIN_STAY_MS
  );
}

// Supabase vraća najviše 1000 redova po upitu — za statistiku treba SVE,
// pa se checkins povlače u stranicama. Poništeni ispod 30 min ne ulaze
// u statistiku (filter u JS-u jer PostgREST ne uspoređuje dvije kolone).
export async function fetchAllCheckins(supabase, userId, groupId, sinceIso) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("checkins")
      .select("user_id, checked_in_at, cancelled_at")
      .order("checked_in_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (userId) query = query.eq("user_id", userId);
    if (groupId) query = query.eq("group_id", groupId);
    // Prozor: Home traži samo zadnjih ~60 dana (dovoljno za tekući mjesec +
    // streak titule); profil/sram-arhiva ne prosljeđuju sinceIso pa idu na sve.
    if (sinceIso) query = query.gte("checked_in_at", sinceIso);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    all.push(...data.filter(countsForStats));
    if (data.length < PAGE) break;
  }
  return all;
}
