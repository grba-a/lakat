// Pića — definicije i helperi za beer log i kolo pića. Ključevi moraju
// odgovarati check constraintu u supabase-pica.sql.
//
// NAMJERNO bez server-only importa — fajl importaju i klijentske
// komponente (omnitrix.jsx, runda-flow.jsx trebaju samo DRINK_TYPES).

export const DRINK_TYPES = [
  { key: "piva", label: "Piva", emoji: "🍺" },
  { key: "gemist", label: "Gemišt", emoji: "🥂" },
  { key: "vino", label: "Vino", emoji: "🍷" },
  { key: "rakija", label: "Rakija", emoji: "⚡" },
  // "sot" je maknut iz ponude (rakija ga pokriva) — ključ i dalje postoji
  // u DB check constraintu zbog starih redova; drinkInfo("sot") vraća null
  { key: "koktel", label: "Koktel", emoji: "🍹" },
  { key: "viski", label: "Viski", emoji: "🥃" },
  { key: "gin", label: "Gin", emoji: "🍸" },
  { key: "vodka", label: "Vodka", emoji: "🧊" },
  { key: "pelin", label: "Pelin", emoji: "🌿" },
  { key: "voda", label: "Voda", emoji: "💧" },
];

const DRINK_BY_KEY = new Map(DRINK_TYPES.map((d) => [d.key, d]));

export function drinkInfo(key) {
  return DRINK_BY_KEY.get(key) ?? null;
}

// Supabase vraća najviše 1000 redova po upitu — za statistiku profila
// treba sve, pa se pića povlače u stranicama (obrazac fetchAllCheckins).
export async function fetchAllDrinks(supabase, userId, groupId, sinceIso) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("drinks")
      .select("user_id, drink_type, logged_at")
      .order("logged_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (userId) query = query.eq("user_id", userId);
    if (groupId) query = query.eq("group_id", groupId);
    if (sinceIso) query = query.gte("logged_at", sinceIso);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

// Najčešći tip pića; izjednačenje rješava redoslijed u DRINK_TYPES
export function favoriteDrink(rows) {
  if (!rows?.length) return null;
  const counts = new Map();
  for (const r of rows) {
    counts.set(r.drink_type, (counts.get(r.drink_type) ?? 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const d of DRINK_TYPES) {
    const c = counts.get(d.key) ?? 0;
    if (c > bestCount) {
      best = d;
      bestCount = c;
    }
  }
  return best;
}
