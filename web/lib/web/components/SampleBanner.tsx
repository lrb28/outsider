"use client";

// Warnt, wenn die App Beispieldaten ausliefert statt echter Offenlegungen —
// etwa auf einer Vorschau-URL ohne Datenbankzugang.
//
// Zwei Feinheiten, die vorher gefehlt haben:
//  • Ein einzelner Verbindungsabriss darf das Banner nicht auslösen. Gemeint ist
//    eine dauerhaft fehlende Datenbank, kein kurzer Aussetzer.
//  • Im Depot ist das Banner schlicht falsch: eigene Buchungen und Börsenkurse
//    kommen gar nicht aus der Datenbank. Dort verunsichert es nur.
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { TradesResponse } from "@/lib/types";

export function SampleBanner() {
  const [isSample, setIsSample] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let on = true;
    const check = () =>
      fetch("/api/trades?limit=1", { cache: "no-store" })
        .then((r) => r.json() as Promise<TradesResponse>)
        .then((d) => d.source === "sample")
        .catch(() => false);

    // Zweimal fragen, mit Pause dazwischen: nur wenn beide Antworten
    // "Beispieldaten" sagen, fehlt die Datenbank wirklich.
    (async () => {
      if (!(await check())) return;
      await new Promise((r) => setTimeout(r, 2500));
      const again = await check();
      if (on && again) setIsSample(true);
    })();

    return () => {
      on = false;
    };
  }, []);

  if (!isSample || pathname?.startsWith("/me")) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto max-w-5xl px-4 py-2 text-xs text-amber-800">
        <strong>Beispieldaten:</strong> Die Investoren- und Politiker-Daten kommen gerade nicht aus
        der Datenbank (vermutlich eine Vorschau-URL). Börsenkurse und dein eigenes Depot sind davon
        nicht betroffen. Die volle App läuft unter{" "}
        <a href="https://outsider-tracker.vercel.app" className="font-medium underline">
          outsider-tracker.vercel.app
        </a>
        .
      </div>
    </div>
  );
}
