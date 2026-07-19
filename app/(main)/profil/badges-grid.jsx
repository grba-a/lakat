import { createClient } from "@/lib/supabase/server";
import { BADGE_DEFS } from "@/lib/badges";
import BadgesList from "./badges-list";

// Osvojeni u boji, neosvojeni-ali-vidljivi zasivljeni, skriveni bedževi
// potpuno izostavljeni dok se ne otključaju (iznenađenje, ne placeholder).
// Prikaz je sklopiv (badges-list.jsx) — otključani prvi.
export default async function BadgesGrid({ userId }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_badges")
    .select("badge_key")
    .eq("user_id", userId);

  const earned = new Set((data ?? []).map((r) => r.badge_key));
  const visible = BADGE_DEFS.filter((b) => earned.has(b.key) || !b.hidden);

  if (!visible.length) return null;

  // Otključani prvi (stabilno unutar obje polovice)
  const badges = [
    ...visible.filter((b) => earned.has(b.key)),
    ...visible.filter((b) => !earned.has(b.key)),
  ].map((b) => ({
    key: b.key,
    label: b.label,
    description: b.description,
    got: earned.has(b.key),
  }));

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Bedževi
      </h2>
      <BadgesList badges={badges} />
    </section>
  );
}
