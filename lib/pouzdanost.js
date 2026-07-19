// Pouzdanost (Kremen/Fantom) — igra oko održane riječi: rekao "stižem"
// na saziv i STVARNO došao (runda sa saziv_id) vs ispario. Broje se samo
// ZAKLJUČENI sazivi (at_time + 3h u prošlosti) — za žive se još ne zna.
// NIJE novi sram: prikazuje se samo na profilu, nikad push, nikad rang.

const SAZIV_ZIVOT_NAKON_MS = 3 * 60 * 60 * 1000;

export const POUZDANOST_MIN_ODAZIVA = 3;

export async function fetchPouzdanost(supabase, userId) {
  const { data: odazivi } = await supabase
    .from("saziv_odazivi")
    .select("saziv_id, sazivi(at_time)")
    .eq("user_id", userId)
    .eq("status", "stizem");

  const zakljuceni = (odazivi ?? []).filter(
    (o) =>
      o.sazivi?.at_time &&
      new Date(o.sazivi.at_time).getTime() + SAZIV_ZIVOT_NAKON_MS < Date.now()
  );
  if (!zakljuceni.length) return { total: 0, held: 0 };

  const ids = zakljuceni.map((o) => o.saziv_id);
  const { data: dosao } = await supabase
    .from("checkins")
    .select("saziv_id")
    .eq("user_id", userId)
    .is("cancelled_at", null)
    .in("saziv_id", ids);

  const heldSet = new Set((dosao ?? []).map((c) => c.saziv_id));
  return { total: zakljuceni.length, held: heldSet.size };
}

// Titula po postotku održane riječi; null dok nema dovoljno odaziva
export function pouzdanostTitle({ total, held }) {
  if (total < POUZDANOST_MIN_ODAZIVA) return null;
  const pct = held / total;
  if (pct >= 0.8) return { label: "Kremen", emoji: "💎", tone: "accent" };
  if (pct >= 0.5) return { label: "Pola-pola", emoji: "🌗", tone: "muted" };
  return { label: "Fantom", emoji: "👻", tone: "danger" };
}
