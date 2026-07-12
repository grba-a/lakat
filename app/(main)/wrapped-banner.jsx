import Link from "next/link";

export default function WrappedBanner({ monthKey }) {
  return (
    <Link
      href={`/profil/wrapped?mjesec=${monthKey}`}
      className="glass pressable-soft mt-6 flex items-center justify-between gap-3 rounded-card px-5 py-4"
    >
      <span>
        <span className="block font-display text-xl uppercase leading-none tracking-wide">
          Tvoj mjesec je spreman.
        </span>
        <span className="mt-1 block text-sm text-muted">Pogledaj štetu.</span>
      </span>
      <span className="shrink-0 text-2xl text-accent">→</span>
    </Link>
  );
}
