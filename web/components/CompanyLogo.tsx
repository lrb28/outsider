"use client";

// Company logo from our cached logo endpoint (/api/logo: Parqet by ISIN, then
// by symbol, then Financial Modeling Prep), else a monogram tile. A rounded
// square like the Eaves app; `rounded="rounded-full"` makes it a circle
// (insider avatars).
import { useState } from "react";

import { fixTicker } from "@/lib/format";

type Edge = "light" | "dark" | "none";
/**
 * What we learnt about a logo file. `field` is the colour of its own
 * background when the border is one flat colour (null: transparent or a
 * picture). `margin` is how far the mark stays from the border (0–0.5 of the
 * side); wordmarks that run edge to edge get room to breathe instead of being
 * cut by the rounded corners.
 */
type Look = { ok: boolean; edge: Edge; field: string | null; margin: number; light: boolean };

// Logos repeat across a page and across pages; what we learnt about one is
// kept, so a remount shows it at once instead of the monogram again.
const known = new Map<string, Look>();

const N = 32;
const lum = (r: number, g: number, b: number) => (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;

/**
 * Reads the logo on a small canvas: the colour of its border, how close the
 * mark comes to it, and whether a transparent mark is itself white (it would
 * vanish on a white tile). Same-origin images only (our endpoint), so the
 * canvas stays readable.
 */
function inspect(img: HTMLImageElement): Look {
  const none: Look = { ok: true, edge: "none", field: null, margin: 0.2, light: false };
  try {
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return none;
    ctx.drawImage(img, 0, 0, N, N);
    const d = ctx.getImageData(0, 0, N, N).data;
    const at = (x: number, y: number) => (y * N + x) * 4;

    // Border: opaque share and average colour.
    let n = 0, opaque = 0, r = 0, g = 0, b = 0;
    const border: number[] = [];
    for (let i = 0; i < N; i++) for (const [x, y] of [[i, 0], [i, N - 1], [0, i], [N - 1, i]]) border.push(at(x, y));
    for (const k of border) {
      n++;
      if (d[k + 3] < 200) continue;
      opaque++;
      r += d[k]; g += d[k + 1]; b += d[k + 2];
    }
    const transparent = opaque < n * 0.5;
    let field: string | null = null;
    let fr = 255, fg = 255, fb = 255;
    if (!transparent) {
      fr = r / opaque; fg = g / opaque; fb = b / opaque;
      const same = border.filter((k) => d[k + 3] >= 200 && Math.abs(d[k] - fr) + Math.abs(d[k + 1] - fg) + Math.abs(d[k + 2] - fb) < 48).length;
      if (same < n * 0.85) return none; // a picture, not a flat field: fill the tile
      field = `rgb(${Math.round(fr)} ${Math.round(fg)} ${Math.round(fb)})`;
    }

    // The mark: everything that differs from the field (or is opaque).
    let x0 = N, y0 = N, x1 = -1, y1 = -1, markLum = 0, markN = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const k = at(x, y);
      const on = transparent ? d[k + 3] > 60 : d[k + 3] > 60 && Math.abs(d[k] - fr) + Math.abs(d[k + 1] - fg) + Math.abs(d[k + 2] - fb) > 60;
      if (!on) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      markLum += lum(d[k], d[k + 1], d[k + 2]); markN++;
    }
    const margin = x1 < 0 ? 0.5 : Math.min(x0, y0, N - 1 - x1, N - 1 - y1) / N;
    const fl = lum(fr, fg, fb);
    return {
      ok: true,
      edge: transparent ? "light" : fl > 0.92 ? "light" : fl < 0.12 ? "dark" : "none",
      field,
      margin,
      light: transparent && markN > 0 && markLum / markN > 0.88,
    };
  } catch {
    return none;
  }
}

function tile(ticker: string | null, company: string, size: number, rounded: string, className = "") {
  const letter = (company || ticker || "?").trim()[0]?.toUpperCase() ?? "?";
  return (
    <span
      style={{ width: size, height: size, minWidth: size }}
      className={`inline-flex shrink-0 items-center justify-center align-top ${rounded} bg-surface2 font-display font-semibold text-subtle ${className}`}
    >
      <span style={{ fontSize: Math.round(size * 0.42) }}>{letter}</span>
    </span>
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
  className = "",
}: {
  ticker: string | null;
  company: string;
  size?: number;
  rounded?: string;
  /** Extra classes on the tile itself, e.g. a lift shadow. Put shadows here,
   *  never on a wrapper: an inline wrapper is taller than the logo and its
   *  shadow shows as a pale band below it. */
  className?: string;
}) {
  const t = fixTicker(ticker, company);
  const cached = t ? known.get(t) : undefined;
  const [state, setState] = useState<Look | null>(cached ?? null);
  if (!t || (state && !state.ok)) return tile(ticker, company, size, rounded, className);

  const loaded = state?.ok === true;
  const round = rounded.includes("full");
  // A mark closer to the border than the corner radius would lose its ends
  // (wordmarks, circles in a circle): shrink it onto its own field colour.
  const pad = loaded && (state.field !== null || state.light || state.edge === "light") && state.margin < (round ? 0.16 : 0.07);
  const inset = pad ? (round ? 0.16 : 0.11) - state.margin : 0;
  const bg = loaded ? state.light ? "rgb(28 28 30)" : state.field ?? "#fff" : undefined;
  return (
    <span
      style={{ width: size, height: size, minWidth: size, background: bg }}
      className={`relative inline-block shrink-0 overflow-hidden align-top ${rounded} ${loaded ? EDGE_CLASS[state.light ? "dark" : state.edge] : ""} ${className}`}
    >
      {!loaded && <span className="absolute inset-0 flex">{tile(ticker, company, size, rounded)}</span>}
      <img
        src={`/api/logo?t=${encodeURIComponent(t)}`}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        style={{
          padding: pad ? Math.round(size * Math.max(0.05, inset)) : 0,
          opacity: loaded ? 1 : 0,
        }}
        onError={() => {
          const k: Look = { ok: false, edge: "none", field: null, margin: 0, light: false };
          known.set(t, k);
          setState(k);
        }}
        onLoad={(e) => {
          const k = inspect(e.currentTarget);
          known.set(t, k);
          setState(k);
        }}
        className={`absolute inset-0 h-full w-full ${pad ? "object-contain" : "object-cover"} transition-opacity duration-300`}
      />
    </span>
  );
}
