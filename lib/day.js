// "Dan" u Lakatu traje od 06:00 do 06:00 po Europe/Zagreb — noć pripada
// prethodnom danu. Sve se računa iz timestampova, nema crona.

const TIME_ZONE = "Europe/Zagreb";

const dtf = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function zagrebParts(date) {
  const parts = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return parts;
}

// Pretvori zagrebačko zidno vrijeme u UTC Date (dvije iteracije pokrivaju DST pomake)
function zagrebTimeToUtc(year, month, day, hour) {
  const want = Date.UTC(year, month - 1, day, hour);
  let ts = want;
  for (let i = 0; i < 2; i++) {
    const p = zagrebParts(new Date(ts));
    ts += want - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  return new Date(ts);
}

// Vraća UTC Date zadnjih 06:00 po Zagrebu: prije 06:00 dan je počeo jučer u 06:00
export function getCurrentDayStart(now = new Date()) {
  const p = zagrebParts(now);
  let { year, month, day } = p;
  if (p.hour < 6) {
    const prev = new Date(Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000);
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth() + 1;
    day = prev.getUTCDate();
  }
  return zagrebTimeToUtc(year, month, day, 6);
}

// "YYYY-MM-DD" lakat-dana kojem timestamp pripada (checkin u 02:00 pripada jučer)
export function getDayKey(date) {
  const p = zagrebParts(new Date(date));
  let { year, month, day } = p;
  if (p.hour < 6) {
    const prev = new Date(Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000);
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth() + 1;
    day = prev.getUTCDate();
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
