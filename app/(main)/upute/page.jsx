import fs from "node:fs";
import path from "node:path";

// Slike koraka: ubaci ih u /public/upute/ pod ovim imenima.
// Dok ne postoje, prikazuje se vidljivi placeholder.
function StepImage({ file, alt }) {
  const exists = fs.existsSync(path.join(process.cwd(), "public", "upute", file));

  if (!exists) {
    return (
      <div className="flex aspect-[9/16] max-h-72 w-full items-center justify-center rounded-card border border-dashed border-white/15 bg-white/[0.03] px-4 text-center text-xs text-muted">
        Slika stiže — ubaci {file} u /public/upute/
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/upute/${file}`}
      alt={alt}
      className="max-h-72 w-full rounded-card border border-white/10 object-contain shadow-soft"
    />
  );
}

function Step({ n, text, file, alt }) {
  return (
    <li className="flex flex-col gap-3">
      <p className="text-sm">
        <span className="mr-2 font-display text-xl text-accent">{n}.</span>
        {text}
      </p>
      <StepImage file={file} alt={alt} />
    </li>
  );
}

export default function UputePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Instaliraj<span className="text-accent">.</span>
        </h1>
        <p className="mt-3 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-muted">
          Na iPhoneu <span className="font-bold text-danger">bez ovoga NEMA notifikacija</span>.
          Nula. Apple tako kaže. Dvije minute posla, ajde.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-accent">
          iPhone (Safari)
        </h2>
        <ol className="mt-4 flex flex-col gap-6">
          <Step
            n={1}
            text="Otvori Lakat u Safariju i stisni Share gumb (kvadratić sa strelicom prema gore, dolje na sredini)."
            file="ios-1.png"
            alt="Safari sa Share gumbom"
          />
          <Step
            n={2}
            text='U meniju nađi i stisni "Dodaj na početni zaslon" (Add to Home Screen).'
            file="ios-2.png"
            alt="Share meni s opcijom Add to Home Screen"
          />
          <Step
            n={3}
            text="Potvrdi. Ikona Lakta ti je sad na home screenu — od sad otvaraj SAMO preko nje."
            file="ios-3.png"
            alt="Home screen s ikonom Lakta"
          />
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-accent">
          Android (Chrome)
        </h2>
        <ol className="mt-4 flex flex-col gap-6">
          <Step
            n={1}
            text='Otvori Lakat u Chromeu, stisni tri točkice gore desno pa "Dodaj na početni zaslon" ili "Instaliraj aplikaciju".'
            file="android-1.png"
            alt="Chrome meni s opcijom instalacije"
          />
          <Step
            n={2}
            text="Potvrdi i gotov si. Vidiš kako je Android jednostavniji? Reci to svom Apple prijatelju."
            file="android-2.png"
            alt="Potvrda instalacije na Androidu"
          />
        </ol>
      </section>
    </main>
  );
}
