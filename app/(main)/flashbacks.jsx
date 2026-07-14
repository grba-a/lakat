import { createClient } from "@/lib/supabase/server";
import { getCurrentDayStart } from "@/lib/day";
import Memorije from "./memorije";

// "Na današnji dan" — flashback slike (3/6/12 mj). Streamano kroz <Suspense>
// da glavni Šank ne čeka na ovo (below-the-fold).
const FLASHBACKS = [
  { months: 3, label: "prije 3 mjeseca" },
  { months: 6, label: "prije pola godine" },
  { months: 12, label: "prije godinu dana" },
];

function shiftMonths(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export default async function Flashbacks({ groupId, usernames, myId }) {
  const supabase = await createClient();
  const dayStart = getCurrentDayStart();

  const results = await Promise.all(
    FLASHBACKS.map(({ months }) => {
      const start = shiftMonths(dayStart, months);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return supabase
        .from("checkins")
        .select("id, user_id, checked_in_at, photo_url, thumb_url")
        .eq("group_id", groupId)
        .not("photo_url", "is", null)
        .gte("checked_in_at", start.toISOString())
        .lt("checked_in_at", end.toISOString());
    })
  );

  const rows = FLASHBACKS.flatMap((_, i) => results[i]?.data ?? []);
  if (!rows.length) return null;

  const ids = [...new Set(rows.map((r) => r.id))];
  const { data: reactionRows } = ids.length
    ? await supabase
        .from("reactions")
        .select("checkin_id, user_id, emoji")
        .in("checkin_id", ids)
    : { data: [] };

  const reactionsByCheckin = {};
  for (const r of reactionRows ?? []) {
    (reactionsByCheckin[r.checkin_id] ??= []).push({
      user_id: r.user_id,
      emoji: r.emoji,
    });
  }

  const items = FLASHBACKS.flatMap(({ label }, i) =>
    (results[i]?.data ?? []).map((m) => ({
      ...m,
      label,
      username: usernames[m.user_id] ?? "Netko",
    }))
  );

  return (
    <Memorije
      flashbacks={items}
      myId={myId}
      initialReactions={reactionsByCheckin}
    />
  );
}
