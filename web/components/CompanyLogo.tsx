"use client";

// Company logo from our cached logo endpoint (/api/logo: Parqet, then
// Financial Modeling Prep), else a monogram tile. A rounded square like the
// Eaves app; `rounded="rounded-full"` makes it a circle (insider avatars).
import { useState } from "react";

import { fixTicker } from "@/lib/format";

type Edge = "light" | "dark" | "none";
type Known = { ok: boolean; edge: Edge };

// Logos repeat across a page and across pages; what we learnt about one is
// kept, so a remount shows it at once instead of the monogram again.
const known = new Map<string, Known>();

/**
 * Reads the logo's border. A logo on a white field would melt into a white
 * card, a black one into the dark card; both get a soft edge. Same-origin
 * images only (our endpoint), so the canvas stays readable.
 */
function edgeOf(img: HTMLImageElement): Edge {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "none";
    ctx.drawImage(img, 0, 0, 16, 16);
    const d = ctx.getImageData(0, 0, 16, 16).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 16; i++) {
      for (const [x, y] of [[i, 0], [i, 15], [0, i], [15, i]]) {
        const k = (y * 16 + x) * 4;
        if (d[k + 3] < 200) continue;
        sum += (d[k] * 0.2126 + d[k + 1] * 0.7152 + d[k + 2] * 0.0722) / 255;
        n++;
      }
    }
    if (n < 20) return "none";
    const avg = sum / n;
    return avg > 0.92 ? "light" : avg < 0.12 ? "dark" : "none";
  } catch {
    return "none";
  }
}

function tile(ticker: string | null, company: string, size: number, rounded: string) {
  const letter = (company || ticker || "?").trim()[0]?.toUpperCase() ?? "?";
  return (
    <div
      style={{ width: size, height: size, minWidth: size }}
      className={`flex shrink-0 items-center justify-center ${rounded} bg-surface2 font-display font-semibold text-subtle`}
    >
      <span style={{ fontSize: Math.round(size * 0.42) }}>{letter}</span>
    </div>
  );
}

const EDGE_CLASS: Record<Edge, string> = {
  light: "logo-edge-light",
  dark: "logo-edge-dark",
  none: "",
};

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
  const t = fixTicker(ticker, company);
  const cached = t ? known.get(t) : undefined;
  const [state, setState] = useState<Known | null>(cached ?? null);
  if (!t || (state && !state.ok)) return tile(ticker, company, size, rounded);

  const loaded = state?.ok === true;
  // A wordmark on a white field would lose its ends to a round crop.
  const fit = rounded.includes("full") && state?.edge === "light" ? "object-contain p-[13%]" : "object-cover";
  return (
    <span
      style={{ width: size, height: size, minWidth: size }}
      className={`relative inline-block shrink-0 ${rounded} ${loaded ? EDGE_CLASS[state.edge] : ""}`}
    >
      {!loaded && <span className="absolute inset-0">{tile(ticker, company, size, rounded)}</span>}
      <img
        src={`/api/logo?t=${encodeURIComponent(t)}`}
        alt=""
        loading="lazy"
        decoding="async"
        style={{ width: size, height: size, minWidth: size, opacity: loaded ? 1 : 0 }}
        onError={() => {
          const k = { ok: false, edge: "none" as Edge };
          known.set(t, k);
          setState(k);
        }}
        onLoad={(e) => {
          const k = { ok: true, edge: edgeOf(e.currentTarget) };
          known.set(t, k);
          setState(k);
        }}
        className={`absolute inset-0 shrink-0 ${rounded} bg-white ${fit} transition-opacity duration-300`}
      />
    </span>
  );
}
