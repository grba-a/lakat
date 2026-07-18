// Brend interpunkcija u display (Anton) fontu: "." cijela accent zelena,
// "?" i "!" bijeli glif sa ZELENOM točkom. Dio glifa se ne može obojati
// CSS-om, pa se znak slaže iz dva sloja s clip-path rezom — gornji sloj
// (tijelo) je currentColor, donji (točka) accent. Wrapper ima leading-none
// da je box uvijek točno 1em → kalibrirani rez vrijedi na svim veličinama
// i line-heightovima. Server-safe (bez state-a) — smiju ga koristiti i
// server i client komponente.

// Postotak visine box-a na kojem počinje točka glifa — kalibrirano
// vizualno za Anton (točka sjedi na baseline ~80% box-a)
const REZ = { "?": 66, "!": 66 };

function GlifSaTockom({ char }) {
  const rez = REZ[char];
  return (
    <span className="relative inline-block align-baseline leading-none">
      <span style={{ clipPath: `inset(0 0 ${100 - rez}% 0)` }}>{char}</span>
      <span
        aria-hidden="true"
        className="absolute inset-0 text-accent"
        style={{ clipPath: `inset(${rez}% 0 0 0)` }}
      >
        {char}
      </span>
    </span>
  );
}

// Prima string i stilira SVE pojave . ? ! u njemu (brend voice vrijedi i
// za korisnički unos u display fontu, npr. mjesto saziva "KOD MENE?!")
export default function BrandPunct({ children }) {
  const text = typeof children === "string" ? children : String(children ?? "");
  const parts = text.split(/([.?!])/);
  return parts.map((part, i) => {
    if (part === ".") {
      return (
        <span key={i} className="text-accent">
          .
        </span>
      );
    }
    if (part === "?" || part === "!") {
      return <GlifSaTockom key={i} char={part} />;
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}
