import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";

// Pošalji push SVIM ostalim korisnicima sa subscriptionom.
// Mrtvi subscriptioni (410/404 od push servisa) se brišu iz baze.
export async function notifyOthers(senderId, senderUsername) {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey || !process.env.SUPABASE_SECRET_KEY) return;

  webpush.setVapidDetails("mailto:pgrbi0@gmail.com", publicKey, privateKey);

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .neq("user_id", senderId);
  if (error || !subs?.length) return;

  const payload = JSON.stringify({
    title: "LAKAT",
    body: `${senderUsername} je za šankom. Miči guzicu.`,
  });

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
