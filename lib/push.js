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

// Pošalji push SVIM ostalim korisnicima sa subscriptionom.
export async function notifyOthers(senderId, senderUsername, body) {
  if (!setupWebpush()) return;

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .neq("user_id", senderId);
  if (error || !subs?.length) return;

  await sendToSubs(admin, subs, body ?? `${senderUsername} je za šankom. Miči guzicu.`);
}

// Pošalji push BAŠ SVIMA (cron: prazan šank)
export async function notifyAll(body) {
  if (!setupWebpush()) return;

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, subscription");
  if (error || !subs?.length) return;

  await sendToSubs(admin, subs, body);
}
