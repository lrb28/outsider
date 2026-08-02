"use client";

// Shows a clear warning when the app is serving bundled sample data (no
// database connection) — e.g. on a Vercel preview deployment without env vars.
// Prevents placeholder numbers from being mistaken for real data.
import { useEffect, useState } from "react";

import { TradesResponse } from "@/lib/types";

export function SampleBanner() {
  const [isSample, setIsSample] = useState(false);

  useEffect(() => {
    fetch("/api/trades?limit=1")
      .then((r) => r.json() as Promise<TradesResponse>)
      .then((d) => setIsSample(d.source === "sample"))
      .catch(() => {});
  }, []);

  if (!isSample) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto max-w-5xl px-4 py-2 text-xs text-amber-800">
        <strong>Beispieldaten:</strong> Diese Ansicht hat keine Datenbankverbindung (vermutlich
        eine Vorschau-URL). Die echte App mit Live-Daten läuft unter{" "}
        <a href="https://outsider-tracker.vercel.app" className="font-medium underline">
          outsider-tracker.vercel.app
        </a>
        .
      </div>
    </div>
  );
}
