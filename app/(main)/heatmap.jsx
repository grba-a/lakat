import { addDays } from "@/lib/stats";

// Vizualni dokaz discipline: heatmap zadnjih 12 tjedana (GitHub stil,
// stupac = tjedan od ponedjeljka) + mini bar-graf po mjesecima. Server
// komponenta, čisti CSS — bez chart librarya.

const WEEKS = 12;
const MONTHS = 6;

function weekdayOf(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  // 0 = ponedjeljak ... 6 = nedjelja
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

const monthFmt = new Intl.DateTimeFormat("hr-HR", {
  month: "short",
  timeZone: "UTC",
});

export default function Heatmap({ daySet, todayKey }) {
  // Početak: ponedjeljak prije (WEEKS-1) tjedana
  const start = addDays(todayKey, -(weekdayOf(todayKey) + (WEEKS - 1) * 7));
  const columns = [];
  for (let w = 0; w < WEEKS; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const key = addDays(start, w * 7 + d);
      days.push({ key, came: daySet.has(key), future: key > todayKey });
    }
    columns.push(days);
  }

  // Dolasci po mjesecima (zadnjih MONTHS)
  const monthCounts = new Map();
  for (const key of daySet) monthCounts.set(key.slice(0, 7), (monthCounts.get(key.slice(0, 7)) ?? 0) + 1);
  const months = [];
  let cursor = todayKey.slice(0, 7);
  for (let i = 0; i < MONTHS; i++) {
    months.unshift({ key: cursor, count: monthCounts.get(cursor) ?? 0 });
    const [y, m] = cursor.split("-").map(Number);
    cursor = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  }
  const maxCount = Math.max(1, ...months.map((m) => m.count));

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Zadnjih 12 tjedana
      </h2>
      <div className="surface-2 mt-4 flex justify-center gap-1 rounded-card px-4 py-4">
        {columns.map((days, w) => (
          <div key={w} className="flex flex-col gap-1">
            {days.map((day) => (
              <div
                key={day.key}
                title={day.key}
                className={`h-4 w-4 rounded-[4px] ${
                  day.future
                    ? "bg-transparent"
                    : day.came
                      ? "bg-accent"
                      : "bg-white/[0.06]"
                }`}
              />
            ))}
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-muted">
        Po mjesecima
      </h2>
      <div className="surface-2 mt-4 flex items-end justify-between gap-2 rounded-card px-4 pb-3 pt-4">
        {months.map((m) => (
          <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-xs font-bold text-accent">{m.count}</span>
            <div className="flex h-20 w-full items-end">
              <div
                className="w-full rounded-t-md bg-accent/70"
                style={{ height: `${Math.round((m.count / maxCount) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {monthFmt.format(new Date(`${m.key}-01T00:00:00Z`))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
