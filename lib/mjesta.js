// Naša mjesta — teritorijalna igra: grupa s najviše rundi na lokaciji u
// zadnjih 30 dana "drži" to mjesto. Klasteriranje je grid (~130 m), sve
// on-the-fly iz checkins (nema tablice ni crona). Ide ADMIN klijentom
// (cross-group), ali van smije SAMO ime grupe koja drži + broj rundi —
// nikad tko/kad/slike.

const GRID_DEG = 0.0012; // ~133 m po širini; dovoljno za "isti kafić"
const MIN_RUNDI = 3; // manje od toga nije "držanje", nego prolazak
export const MJESTA_WINDOW_DAYS = 30;

// Vlasnik jedne ćelije iz njenih redova: najviše rundi, min prag, bez
// vlasnika kod izjednačenja na vrhu (isto pravilo kao computeMjesta)
export function holderOf(rows) {
  const byGroup = new Map();
  for (const r of rows) {
    byGroup.set(r.group_id, (byGroup.get(r.group_id) ?? 0) + 1);
  }
  const sorted = [...byGroup.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length || sorted[0][1] < MIN_RUNDI) return null;
  if (sorted.length > 1 && sorted[1][1] === sorted[0][1]) return null;
  return sorted[0][0];
}

// Otimanje mjesta — poziva se ODMAH NAKON inserta runde s koordinatama:
// usporedi vlasnika grid ćelije bez ovog checkina i s njim. Promjena =
// osvajanje (ničija zemlja → grupa) ili otimanje (grupa A → grupa B).
// Tihe promjene starenjem rundi iz prozora nemaju event pa ni push —
// mjesto se osvaja isključivo dolaskom.
export async function detectOtimanje({ admin, lat, lng, checkinId }) {
  const sinceIso = new Date(
    Date.now() - MJESTA_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Granice ćelije iz Math.round semantike: round(x/G)=c ⟺ x ∈ [(c-.5)G, (c+.5)G)
  const cellLat = Math.round(lat / GRID_DEG);
  const cellLng = Math.round(lng / GRID_DEG);
  const { data: rows } = await admin
    .from("checkins")
    .select("id, group_id")
    .is("cancelled_at", null)
    .gte("checked_in_at", sinceIso)
    .gte("lat", (cellLat - 0.5) * GRID_DEG)
    .lt("lat", (cellLat + 0.5) * GRID_DEG)
    .gte("lng", (cellLng - 0.5) * GRID_DEG)
    .lt("lng", (cellLng + 0.5) * GRID_DEG);

  const prije = holderOf((rows ?? []).filter((r) => r.id !== checkinId));
  const poslije = holderOf(rows ?? []);
  if (!poslije || prije === poslije) return null;

  const ids = [poslije, ...(prije ? [prije] : [])];
  const { data: groups } = await admin
    .from("groups")
    .select("id, name")
    .in("id", ids);
  const names = new Map((groups ?? []).map((g) => [g.id, g.name]));

  return {
    novi: { id: poslije, name: names.get(poslije) ?? "Netko" },
    prijasnji: prije
      ? { id: prije, name: names.get(prije) ?? "Netko" }
      : null,
  };
}

export async function computeMjesta({ admin }) {
  const sinceIso = new Date(
    Date.now() - MJESTA_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const [{ data: checkins }, { data: groups }] = await Promise.all([
    admin
      .from("checkins")
      .select("group_id, lat, lng")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .is("cancelled_at", null)
      .gte("checked_in_at", sinceIso),
    admin.from("groups").select("id, name"),
  ]);

  const names = new Map((groups ?? []).map((g) => [g.id, g.name]));

  // Grid ćelije: centar = prosjek točaka, brojanje rundi po grupi
  const cells = new Map();
  for (const c of checkins ?? []) {
    const key = `${Math.round(c.lat / GRID_DEG)}|${Math.round(c.lng / GRID_DEG)}`;
    if (!cells.has(key)) {
      cells.set(key, { latSum: 0, lngSum: 0, n: 0, byGroup: new Map() });
    }
    const cell = cells.get(key);
    cell.latSum += c.lat;
    cell.lngSum += c.lng;
    cell.n += 1;
    cell.byGroup.set(c.group_id, (cell.byGroup.get(c.group_id) ?? 0) + 1);
  }

  const mjesta = [];
  for (const cell of cells.values()) {
    const sorted = [...cell.byGroup.entries()].sort((a, b) => b[1] - a[1]);
    const [topId, topCount] = sorted[0];
    if (topCount < MIN_RUNDI) continue;
    // Izjednačenje na vrhu = mjesto se još bori, nema vlasnika
    const contested = sorted.length > 1 && sorted[1][1] === topCount;
    mjesta.push({
      lat: cell.latSum / cell.n,
      lng: cell.lngSum / cell.n,
      holder: contested ? null : (names.get(topId) ?? "Netko"),
      count: topCount,
    });
  }
  return mjesta;
}
