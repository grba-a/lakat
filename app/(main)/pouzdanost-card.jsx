import { pouzdanostTitle, POUZDANOST_MIN_ODAZIVA } from "@/lib/pouzdanost";

const TONE_TEXT = {
  accent: "text-accent",
  muted: "text-muted",
  danger: "text-danger",
};
const TONE_BAR = {
  accent: "bg-accent",
  muted: "bg-white/40",
  danger: "bg-danger",
};

// Pouzdanost na profilu: koliko puta je "stižem" na saziv završilo pravim
// dolaskom. Ne prikazuje se dok osoba nema nijedan zaključeni odaziv.
export default function PouzdanostCard({ total, held, own = true }) {
  if (!total) return null;

  const title = pouzdanostTitle({ total, held });
  const pct = Math.round((held / total) * 100);

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Pouzdanost
      </h2>
      <div className="surface-2 mt-4 rounded-card px-4 py-5 shadow-soft">
        {title ? (
          <p className={`font-display text-3xl uppercase leading-none tracking-tight ${TONE_TEXT[title.tone]}`}>
            {title.label} {title.emoji}
          </p>
        ) : (
          <p className="font-display text-3xl uppercase leading-none tracking-tight text-muted">
            Još se mjeri...
          </p>
        )}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${TONE_BAR[title?.tone ?? "muted"]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-muted">
          {own ? "Rekao si" : "Rekao je"} „stižem“ {total}{" "}
          {total === 1 ? "put" : "puta"}, {own ? "došao si" : "došao je"}{" "}
          {held} ({pct}%).
          {!title &&
            ` Ocjena stiže nakon ${POUZDANOST_MIN_ODAZIVA} odaziva.`}
          {title?.label === "Fantom" && " Riječ ti ne vrijedi ni pola piva."}
          {title?.label === "Kremen" && " Riječ tvrđa od kamena."}
        </p>
      </div>
    </section>
  );
}
