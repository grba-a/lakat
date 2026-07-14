// Zeleni plus u sredini navbara (TikTok stil) — izdvojen u svoj fajl da ga
// identično renderiraju i lazy placeholder u nav.jsx i pravi runda-flow.jsx
export default function PlusButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Nova runda"
      className="pressable relative z-10 -mt-6 mx-1 flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-full border-4 border-background bg-accent text-black shadow-glow disabled:opacity-60"
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </button>
  );
}
