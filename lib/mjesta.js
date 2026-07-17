// Naša mjesta — teritorijalna igra: grupa s najviše rundi na lokaciji u
// zadnjih 30 dana "drži" to mjesto. Klasteriranje je grid (~130 m), sve
// on-the-fly iz checkins (nema tablice ni crona). Ide ADMIN klijentom
// (cross-group), ali van smije SAMO ime grupe koja drži + broj rundi —
// nikad tko/kad/slike.

const GRID_DEG = 0.0012; // ~133 m po širini; dovoljno za "isti kafić"
const MIN_RUNDI = 3; // manje od toga nije "držanje", nego prolazak
export const MJESTA_WINDOW_DAYS = 30;

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
