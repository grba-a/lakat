"use client";

import { useState } from "react";
import BadgeToast from "../badge-toast";

// Server je već izračunao newBadges (nula dodatnih upita — koristi
// allTimeStats koji /shame ionako računa); ovaj wrapper samo prikazuje
// toast na mountu, bez ikakvog fetcha.
export default function ShameBadgeToast({ initialBadges = [] }) {
  const [queue, setQueue] = useState(initialBadges);

  return (
    <BadgeToast
      queue={queue}
      onDone={(key) => setQueue((prev) => prev.filter((b) => b.key !== key))}
    />
  );
}
