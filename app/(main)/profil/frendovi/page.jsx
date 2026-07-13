import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/groups";
import FrendoviClient from "./frendovi-client";

export default async function FrendoviPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const [{ data: me }, { data: friendRows }, { data: inviteRows }, groups] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("friend_code, username")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("friendships")
        .select("id, requester, addressee, status, created_at")
        .or(`requester.eq.${user.id},addressee.eq.${user.id}`),
      supabase
        .from("group_invites")
        .select("id, group_id, inviter, status")
        .eq("invitee", user.id)
        .eq("status", "pending"),
      getMyGroups(supabase, user.id),
    ]);

  // Profili druge strane (frendovi + oni koji su nas pozvali u grupu) —
  // RLS ih pušta jer prijateljski red već postoji, isti klijent radi
  const otherIds = [
    ...new Set(
      (friendRows ?? []).map((r) => (r.requester === user.id ? r.addressee : r.requester))
    ),
  ];
  const inviterIds = [...new Set((inviteRows ?? []).map((r) => r.inviter))];
  const profileIds = [...new Set([...otherIds, ...inviterIds])];

  const { data: profiles } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, avatar_url, last_seen_at")
        .in("id", profileIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Nazivi grupa za pozive idu preko admin klijenta — invitee nije član
  // grupe pa RLS na "groups" ne pušta ime dok poziv ne prihvati
  const inviteGroupIds = [...new Set((inviteRows ?? []).map((r) => r.group_id))];
  let groupNameMap = new Map();
  if (inviteGroupIds.length) {
    const admin = createAdminClient();
    const { data: inviteGroups } = await admin
      .from("groups")
      .select("id, name")
      .in("id", inviteGroupIds);
    groupNameMap = new Map((inviteGroups ?? []).map((g) => [g.id, g.name]));
  }

  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const row of friendRows ?? []) {
    const otherId = row.requester === user.id ? row.addressee : row.requester;
    const other = profileMap.get(otherId);
    if (!other) continue;
    const item = { friendshipId: row.id, ...other };
    if (row.status === "accepted") friends.push(item);
    else if (row.requester === user.id) outgoing.push(item);
    else incoming.push(item);
  }
  friends.sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? ""));

  const invites = (inviteRows ?? []).map((row) => ({
    id: row.id,
    groupName: groupNameMap.get(row.group_id) ?? "Grupa",
    inviterUsername: profileMap.get(row.inviter)?.username ?? "Netko",
  }));

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
        invites={invites}
        groups={groups}
      />
    </main>
  );
}
