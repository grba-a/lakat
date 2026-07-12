import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentDayStart } from "@/lib/day";
import { notifyGroup } from "@/lib/push";
import { praznaSankPushBody } from "@/lib/push-copy";

// Vercel cron: 19:00 UTC = 21:00 po Zagrebu LJETI (zimi 20:00 — cron ne zna
// za DST; ako zasmeta, promijeni schedule u vercel.json na "0 20 * * *").
// Svaka grupa se provjerava posebno: čiji je šank prazan, ta ekipa dobije packu.
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Odbij." }, { status: 401 });
  }

  const admin = createAdminClient();
  const dayStartIso = getCurrentDayStart().toISOString();

  const [{ data: groups, error: groupsError }, { data: activeCheckins, error: checkinsError }] =
    await Promise.all([
      admin.from("groups").select("id, name"),
      admin
        .from("checkins")
        .select("group_id")
        .is("cancelled_at", null)
        .gte("checked_in_at", dayStartIso),
    ]);

  if (groupsError || checkinsError) {
    return NextResponse.json(
      { error: (groupsError ?? checkinsError).message },
      { status: 500 }
    );
  }

  const busy = new Set((activeCheckins ?? []).map((c) => c.group_id));
  const empty = (groups ?? []).filter((g) => !busy.has(g.id));

  await Promise.allSettled(
    empty.map((g) =>
      notifyGroup({
        groupId: g.id,
        groupName: g.name,
        body: praznaSankPushBody(),
      })
    )
  );

  return NextResponse.json({
    ok: true,
    groups: groups?.length ?? 0,
    sent: empty.length,
  });
}
