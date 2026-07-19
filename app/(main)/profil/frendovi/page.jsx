import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import FrendoviClient from "./frendovi-client";

const SUGGESTION_LIMIT = 6;

export default async function FrendoviPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const [{ data: me }, { data: friendRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("friend_code, username")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("friendships")
      .select("id, requester, addressee, status, created_at")
      .or(`requester.eq.${user.id},addressee.eq.${user.id}`),
  ]);

  // Profili druge strane — RLS ih pušta jer red (i pending) već postoji
  const otherIds = [
    ...new Set(
      (friendRows ?? []).map((r) => (r.requester === user.id ? r.addressee : r.requester))
    ),
  ];
  const { data: profiles } = otherIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, avatar_url, last_seen_at")
        .in("id", otherIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const friends = [];
  const incoming = [];
  const outgoing = [];
  const acceptedIds = [];
  for (const row of friendRows ?? []) {
    const otherId = row.requester === user.id ? row.addressee : row.requester;
    const other = profileMap.get(otherId);
    if (!other) continue;
    const item = { friendshipId: row.id, ...other };
    if (row.status === "accepted") {
      friends.push(item);
      acceptedIds.push(otherId);
    } else if (row.requester === user.id) outgoing.push(item);
    else incoming.push(item);
  }
  friends.sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? ""));

  // "Možda se znate": frendovi mojih frendova (2. krug) s brojem
  // zajedničkih — ide ADMIN klijentom (tuđa frendstva RLS ne pušta), a
  // van izlazi SAMO username + avatar + broj zajedničkih (namjerno javno)
  let suggestions = [];
  if (acceptedIds.length) {
    try {
      const admin = createAdminClient();
      const orExpr = acceptedIds
        .map((id) => `requester.eq.${id},addressee.eq.${id}`)
        .join(",");
      const { data: secondDegree } = await admin
        .from("friendships")
        .select("requester, addressee")
        .eq("status", "accepted")
        .or(orExpr);

      const involved = new Set([user.id, ...otherIds]);
      const mutualCount = new Map();
      const acceptedSet = new Set(acceptedIds);
      for (const r of secondDegree ?? []) {
        for (const [a, b] of [
          [r.requester, r.addressee],
          [r.addressee, r.requester],
        ]) {
          // a = moj frend, b = njegov frend kojeg ja (možda) ne znam
          if (!acceptedSet.has(a) || involved.has(b)) continue;
          mutualCount.set(b, (mutualCount.get(b) ?? 0) + 1);
        }
      }

      const top = [...mutualCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, SUGGESTION_LIMIT);
      if (top.length) {
        const { data: sugProfiles } = await admin
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", top.map(([id]) => id));
        const byId = new Map((sugProfiles ?? []).map((p) => [p.id, p]));
        suggestions = top
          .map(([id, n]) => {
            const p = byId.get(id);
            return p ? { id, username: p.username, avatar_url: p.avatar_url, mutual: n } : null;
          })
          .filter(Boolean);
      }
    } catch {
      // prijedlozi su bonus
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Pajdaši<span className="text-accent">.</span>
        </h1>
      </section>

      <FrendoviClient
        myCode={me?.friend_code}
        friends={friends}
        incoming={incoming}
        outgoing={outgoing}
        suggestions={suggestions}
      />
    </main>
  );
}
