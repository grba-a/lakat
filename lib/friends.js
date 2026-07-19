// Prijatelji — središnji graf vidljivosti u LAKAT 3.0.

// Isti prozor kao presence u frendovi-client.jsx (heartbeat)
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

// ID-jevi prihvaćenih frendova. Radi i s user-scoped klijentom (RLS pušta
// vlastite friendshipe) i s admin klijentom (za pusheve).
export async function friendIdsOf(client, userId) {
  const { data: rows } = await client
    .from("friendships")
    .select("requester, addressee")
    .eq("status", "accepted")
    .or(`requester.eq.${userId},addressee.eq.${userId}`);
  return [
    ...new Set(
      (rows ?? []).map((r) => (r.requester === userId ? r.addressee : r.requester))
    ),
  ];
}

// Broj trenutno aktivnih (online) frendova za badge u headeru
export async function countActiveFriends(supabase, userId) {
  const ids = await friendIdsOf(supabase, userId);
  if (!ids.length) return 0;

  const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("id", ids)
    .gte("last_seen_at", since);

  return count ?? 0;
}
