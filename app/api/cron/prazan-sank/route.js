import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentDayStart } from "@/lib/day";
import { notifyAll } from "@/lib/push";

// Vercel cron: 19:00 UTC = 21:00 po Zagrebu LJETI (zimi 20:00 — cron ne zna
// za DST; ako zasmeta, promijeni schedule u vercel.json na "0 20 * * *").
// Ako se do tada nitko nije checkirao, svi dobiju packu.
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Odbij." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("checkins")
    .select("id")
    .is("cancelled_at", null)
    .gte("checked_in_at", getCurrentDayStart().toISOString())
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (data?.length) {
    return NextResponse.json({ ok: true, sent: false, reason: "netko je za šankom" });
  }

  await notifyAll("21 je sati, a šank zjapi prazan. Sram vas bilo, pičke.");
  return NextResponse.json({ ok: true, sent: true });
}
