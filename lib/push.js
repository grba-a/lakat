import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";
import { friendIdsOf } from "./friends";

function setupWebpush() {
  // Za vrijeme lockdowna (/uskoro) nitko ne može u app, pa pushevi samo
  // frustriraju — jedan guard ovdje gasi SVE (akcije i cron rute)
  if (process.env.LAKAT_LOCKDOWN === "1") return false;
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

// Push SVIM frendovima korisnika (osim excludeIds) — 3.0 zamjena za
// nekadašnji notifyGroup; nema više [Naziv grupe] prefiksa
export async function notifyFriends({ userId, excludeIds = [], body }) {
  if (!setupWebpush()) return;

  const admin = createAdminClient();
  const ids = (await friendIdsOf(admin, userId)).filter(
    (id) => !excludeIds.includes(id)
  );
  if (!ids.length) return;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .in("user_id", ids);
  if (!subs?.length) return;

  await sendToSubs(admin, subs, body);
}

// Push jednom korisniku (friend zahtjevi, stižem meti, FOMO, streak)
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
