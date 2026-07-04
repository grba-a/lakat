// Supabase vraća najviše 1000 redova po upitu — za statistiku treba SVE,
// pa se checkins povlače u stranicama.
export async function fetchAllCheckins(supabase, userId) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("checkins")
      .select("user_id, checked_in_at")
      .order("checked_in_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}
