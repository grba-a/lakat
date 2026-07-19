import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRang, weekStartKey, bodovaLabel } from "@/lib/rang";

// Widget na vrhu Šanka: moja pozicija među pajdašima + globalno (broj).
// Best-effort — Šank živi i bez ranga.
export default async function RangWidget({ userId, friendIds, todayKey }) {
  let rang = null;
  try {
    rang = await computeRang({
      admin: createAdminClient(),
      userId,
      friendIds,
      weekKey: weekStartKey(todayKey),
    });
  } catch {
    return null;
  }
  if (!rang) return null;

  return (
    <Link
      href="/rang"
      className="pressable mt-4 flex items-center justify-between rounded-card border border-white/10 bg-white/[0.03] px-4 py-2.5"
    >
      <span className="text-xs font-bold uppercase tracking-widest">
        🏆 {rang.friendRank}. među pajdašima{" "}
        <span className="text-muted">· #{rang.globalRank} u svijetu</span>
      </span>
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
        <span className="text-muted">{bodovaLabel(rang.mine.points)}</span>
        <span className="text-muted">›</span>
      </span>
    </Link>
  );
}
