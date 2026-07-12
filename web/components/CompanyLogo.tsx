"use client";

// Company logo with a graceful fallback chain: Parqet -> Financial Modeling
// Prep -> a coloured monogram tile. Renders a rounded square like the Eaves app.
import { useState } from "react";

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
  if (!ticker) return tile(ticker, company, size, rounded);

  const srcs = [
    `https://assets.parqet.com/logos/symbol/${ticker}`,
    `https://financialmodelingprep.com/image-stock/${ticker}.png`,
  ];
  if (step >= srcs.length) return tile(ticker, company, size, rounded);

  return (
    <img
      src={srcs[step]}
      alt=""
      loading="lazy"
      style={{ width: size, height: size, minWidth: size }}
      onError={() => setStep((s) => s + 1)}
      className={`shrink-0 ${rounded} bg-white object-contain p-0.5 ring-1 ring-hair`}
    />
  );
}
