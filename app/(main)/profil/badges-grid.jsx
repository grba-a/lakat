import { createClient } from "@/lib/supabase/server";
import { BADGE_DEFS } from "@/lib/badges";

// Osvojeni u boji, neosvojeni-ali-vidljivi zasivljeni, skriveni bedževi
// potpuno izostavljeni dok se ne otključaju (iznenađenje, ne placeholder).
export default async function BadgesGrid({ userId, groupId }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_badges")
    .select("badge_key")
    .eq("user_id", userId)
    .eq("group_id", groupId);

  const earned = new Set((data ?? []).map((r) => r.badge_key));
  const visible = BADGE_DEFS.filter((b) => earned.has(b.key) || !b.hidden);

  if (!visible.length) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Bedževi
      </h2>
      <div className="stagger mt-4 grid grid-cols-3 gap-2">
        {visible.map((badge, i) => {
          const got = earned.has(badge.key);
          return (
            <div
              key={badge.key}
              className={`rounded-card border px-3 py-4 text-center ${
                got
                  ? "border-accent/40 bg-accent/10"
                  : "border-white/10 bg-white/[0.03] opacity-40"
              }`}
              style={{ "--stagger-i": Math.min(i, 8) }}
            >
              <p
                className={`font-display text-sm uppercase leading-tight tracking-wide ${
                  got ? "text-accent" : "text-muted"
                }`}
              >
                {badge.label}
              </p>
              <p className="mt-1 text-[10px] text-muted">{badge.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
