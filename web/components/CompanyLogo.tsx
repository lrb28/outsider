"use client";

// Company logo with a graceful fallback chain: Parqet -> Financial Modeling
// Prep -> a coloured monogram tile. Renders a rounded square like the Eaves app.
import { useState } from "react";

import { fixTicker } from "@/lib/format";

function tile(ticker: string | null, company: string, size: number, rounded: string) {
  const letter = (company || ticker || "?").trim()[0]?.toUpperCase() ?? "?";
  return (
    <div
      style={{ width: size, height: size, minWidth: size }}
      className={`flex shrink-0 items-center justify-center ${rounded} bg-slate-100 font-semibold text-slate-500 ring-1 ring-hair`}
    >
      <span style={{ fontSize: Math.round(size * 0.42) }}>{letter}</span>
    </div>
  );
}

export function CompanyLogo({
  ticker,
  company,
  size = 36,
  rounded = "rounded-xl",
}: {
  ticker: string | null;
  company: string;
  size?: number;
  rounded?: string;
}) {
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const t = fixTicker(ticker, company);
  if (!t) return tile(ticker, company, size, rounded);

  const srcs = [
    `https://assets.parqet.com/logos/symbol/${t}`,
    `https://financialmodelingprep.com/image-stock/${t}.png`,
  ];
  if (step >= srcs.length) return tile(ticker, company, size, rounded);

  // Bis das Logo geladen ist, steht bereits das Monogramm an derselben Stelle.
  // Vorher blitzten sekundenlang leere weiße Kacheln auf — das ließ die Seite
  // kaputt aussehen, obwohl nur ein Bild unterwegs war.
  return (
    <span
      style={{ width: size, height: size, minWidth: size }}
      className={`relative inline-block shrink-0 ${rounded}`}
    >
      {!loaded && (
        <span className="absolute inset-0">{tile(ticker, company, size, rounded)}</span>
      )}
      <img
        src={srcs[step]}
        alt=""
        loading="lazy"
        style={{ width: size, height: size, minWidth: size, opacity: loaded ? 1 : 0 }}
        onError={() => {
          setLoaded(false);
          setStep((s) => s + 1);
        }}
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 shrink-0 ${rounded} bg-white object-contain p-0.5 ring-1 ring-hair transition-opacity duration-300`}
      />
    </span>
  );
}
