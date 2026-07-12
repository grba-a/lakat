"use client";

import { useState } from "react";

// Čisti prekidač vidljivosti — oba sadržaja su već izrenderana server-side
// i proslijeđena kao djeca, toggle ne radi nikakav fetch.
export default function ShameTabs({ month, allTime }) {
  const [tab, setTab] = useState("month");

  return (
    <>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("month")}
          className={`pressable-soft h-10 flex-1 rounded-full text-xs font-bold uppercase tracking-widest ${
            tab === "month"
              ? "bg-accent text-black"
              : "surface-2 text-muted"
          }`}
        >
          Ovaj mjesec
        </button>
        <button
          type="button"
          onClick={() => setTab("alltime")}
          className={`pressable-soft h-10 flex-1 rounded-full text-xs font-bold uppercase tracking-widest ${
            tab === "alltime"
              ? "bg-accent text-black"
              : "surface-2 text-muted"
          }`}
        >
          Svih vremena
        </button>
      </div>

      {tab === "month" ? month : allTime}
    </>
  );
}
