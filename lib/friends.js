// Prijatelji: brojanje trenutno aktivnih (online) za badge u headeru.
// Isti prozor kao presence u frendovi-client.jsx (3 min od zadnjeg heartbeata).
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

// RLS pušta čitanje vlastitih friendshipa i profila frendova
// (is_friend_or_pending), pa radi s običnim user-scoped klijentom.
export async function countActiveFriends(supabase, userId) {
  const { data: rows } = await supabase
    .from("friendships")
    .select("requester, addressee")
    .eq("status", "accepted")
    .or(`requester.eq.${userId},addressee.eq.${userId}`);

  const ids = (rows ?? []).map((r) =>
    r.requester === userId ? r.addressee : r.requester
  );
  if (!ids.length) return 0;

  const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("id", ids)
    .gte("last_seen_at", since);

  return count ?? 0;
}
