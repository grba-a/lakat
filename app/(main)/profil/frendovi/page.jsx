import Link from "next/link";
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

  const { data: friendRows } = await supabase
    .from("friendships")
    .select("id, requester, addressee, status, created_at")
    .or(`requester.eq.${user.id},addressee.eq.${user.id}`);

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

      // Odbijeni prijedlozi ne nestaju — samo se guraju na kraj liste
      const { data: dismissedRows } = await admin
        .from("suggestion_dismissals")
        .select("dismissed_id, dismissed_at")
        .eq("user_id", user.id);
      const dismissedAt = new Map(
        (dismissedRows ?? []).map((d) => [d.dismissed_id, d.dismissed_at])
      );

      const top = [...mutualCount.entries()]
        .map(([id, n]) => ({ id, mutual: n, dismissed: dismissedAt.get(id) ?? null }))
        .sort((a, b) => {
          // ne-odbijeni prije odbijenih; unutar grupe po broju zajedničkih,
          // a odbijeni po starosti odbijanja (najstariji se prvi vraćaju)
          const ad = a.dismissed ? 1 : 0;
          const bd = b.dismissed ? 1 : 0;
          if (ad !== bd) return ad - bd;
          if (a.dismissed && b.dismissed) return a.dismissed.localeCompare(b.dismissed);
          return b.mutual - a.mutual;
        })
        .slice(0, SUGGESTION_LIMIT);
      if (top.length) {
        const { data: sugProfiles } = await admin
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", top.map((t) => t.id));
        const byId = new Map((sugProfiles ?? []).map((p) => [p.id, p]));
        suggestions = top
          .map((t) => {
            const p = byId.get(t.id);
            return p
              ? { id: t.id, username: p.username, avatar_url: p.avatar_url, mutual: t.mutual }
              : null;
          })
          .filter(Boolean);
      }
    } catch {
      // prijedlozi su bonus
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <section className="relative mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Pajdaši<span className="text-accent">.</span>
        </h1>
        <Link
          href="/profil/frendovi/qr"
          aria-label="Moj QR"
          className="pressable absolute -top-2 right-0 rounded-full p-2 text-accent/70 active:bg-white/5"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M7 12h10" />
          </svg>
        </Link>
      </section>

      <FrendoviClient
        friends={friends}
        incoming={incoming}
        outgoing={outgoing}
        suggestions={suggestions}
      />
    </main>
  );
}
