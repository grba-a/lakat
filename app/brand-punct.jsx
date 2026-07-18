// Brend interpunkcija u display (Anton) fontu: ".", "?" i "!" se renderiraju
// CIJELI u accent zelenoj — brend voice, dosljedno kroz cijelu app.
// Server-safe (bez state-a) — smiju ga koristiti i server i client komponente.

// Prima string i stilira SVE pojave . ? ! u njemu (vrijedi i za korisnički
// unos u display fontu, npr. mjesto saziva "KOD MENE?!")
export default function BrandPunct({ children }) {
  const text = typeof children === "string" ? children : String(children ?? "");
  const parts = text.split(/([.?!]+)/);
  return parts.map((part, i) => {
    if (/^[.?!]+$/.test(part)) {
      return (
        <span key={i} className="text-accent">
          {part}
        </span>
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}
