import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";

function setupWebpush() {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey || !process.env.SUPABASE_SECRET_KEY) return false;
  webpush.setVapidDetails("mailto:pgrbi0@gmail.com", publicKey, privateKey);
  return true;
}

// Mrtvi subscriptioni (410/404 od push servisa) se brišu iz baze
async function sendToSubs(admin, subs, body) {
  const payload = JSON.stringify({ title: "LAKAT", body });
  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
        }
      }
    })
  );
}

// Push članovima jedne grupe (osim pošiljatelja). Tko je u 2+ grupa dobiva
// prefiks naziva grupe da zna koji ga šank zove.
export async function notifyGroup({ groupId, groupName, senderId = null, body }) {
  if (!setupWebpush()) return;

  const admin = createAdminClient();

  const { data: members, error: membersError } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  if (membersError || !members?.length) return;

  const ids = members.map((m) => m.user_id).filter((id) => id !== senderId);
  if (!ids.length) return;

  const [{ data: allMemberships }, { data: subs, error: subsError }] =
    await Promise.all([
      admin.from("group_members").select("user_id").in("user_id", ids),
      admin
        .from("push_subscriptions")
        .select("id, subscription, user_id")
        .in("user_id", ids),
    ]);
  if (subsError || !subs?.length) return;

  const membershipCount = {};
  for (const m of allMemberships ?? []) {
    membershipCount[m.user_id] = (membershipCount[m.user_id] ?? 0) + 1;
  }
  const multi = subs.filter((s) => (membershipCount[s.user_id] ?? 1) > 1);
  const single = subs.filter((s) => (membershipCount[s.user_id] ?? 1) <= 1);

  await Promise.all([
    single.length ? sendToSubs(admin, single, body) : null,
    multi.length && groupName
      ? sendToSubs(admin, multi, `[${groupName}] ${body}`)
      : multi.length
        ? sendToSubs(admin, multi, body)
        : null,
  ]);
}

// Push jednom korisniku (friend zahtjevi, pozivi u grupu)
export async function notifyUser({ userId, body }) {
  if (!setupWebpush()) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", userId);
  if (!subs?.length) return;

  await sendToSubs(admin, subs, body);
}
