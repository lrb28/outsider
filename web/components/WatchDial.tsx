"use client";

import { forwardRef, useCallback, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";

import { shortFund } from "@/lib/format";

/*
 * The names of the watchlist on a wheel (after the user's reference video,
 * 2026-10-07): the names run along the lower rim of a large circle, the
 * current one level in the middle, its neighbours tilting up and away and
 * fading at the edges. Swiping turns the wheel with the finger; a tap on the
 * band closes the swipe view (the pager handles both). The pager drives it
 * frame by frame through `set(p)`, where p is the position in names (2.4 =
 * four tenths of the way from the third name to the fourth).
 */

const GAP = 30; // arc length between two names, px
const H = 64; // height of the band
const BASE = 50; // baseline of the current name
const FADE = "linear-gradient(90deg, transparent 0%, #000 22%, #000 78%, transparent 100%)";
const TEXT = { fontSize: 14, fontWeight: 600, letterSpacing: "0.06em" } as const;

export type DialHandle = { set: (p: number) => void };

const mod = (k: number, n: number) => ((k % n) + n) % n;

/** A fund without a person reads as its short name: "PERSHING SQUARE CAPITAL". */
function dialName(name: string) {
  const s = shortFund(name);
  return (s.length > 24 ? `${s.slice(0, 23).trimEnd()}…` : s).toUpperCase();
}

export const WatchDial = forwardRef<DialHandle, { names: string[]; loop: boolean; cur: number }>(function WatchDial({ names, loop, cur }, ref) {
  const arc = `dial-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const box = useRef<HTMLDivElement>(null);
  const meter = useRef<SVGGElement>(null);
  const labels = useRef(new Map<number, { text: SVGTextElement; path: SVGTextPathElement }>());
  const widths = useRef<number[]>([]);
  const pos = useRef(cur);
  const [w, setW] = useState(0);

  const n = names.length;
  // A tighter wheel on phones, a gentler one on wide screens.
  const R = Math.min(640, Math.max(300, w * 0.85));
  const L = 2 * Math.PI * R;
  const cx = w / 2;
  const cy = BASE - R;
  // A full circle from the top, down the left side, along the bottom (left
  // to right, so the names stand upright) and back up the right side: the
  // middle of the bottom is at L / 2.
  const d = `M ${cx} ${cy - R} A ${R} ${R} 0 0 0 ${cx} ${cy + R} A ${R} ${R} 0 0 0 ${cx} ${cy - R}`;

  const set = useCallback(
    (p: number) => {
      pos.current = p;
      if (!n) return;
      const wd = (k: number) => widths.current[mod(k, n)] ?? 0;
      // Names keep an even gap between them, whatever their length.
      const step = (k: number) => wd(k) / 2 + GAP + wd(k + 1) / 2;
      const base = Math.floor(p);
      const head = -(p - base) * step(base);
      for (const [k, { text, path }] of labels.current) {
        let o = head;
        if (k >= base) for (let i = base; i < k; i++) o += step(i);
        else for (let i = base - 1; i >= k; i--) o -= step(i);
        path.setAttribute("startOffset", (L / 2 + o).toFixed(2));
        const dist = Math.abs(k - p);
        const fade = dist <= 1 ? 1 - 0.4 * dist : Math.max(0, 0.6 - 0.3 * (dist - 1));
        text.style.opacity = Math.abs(o) > L / 2 - 80 ? "0" : fade.toFixed(3);
      }
    },
    [n, L],
  );
  useImperativeHandle(ref, () => ({ set }), [set]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Each name's length along the arc, measured once the face is in.
  useLayoutEffect(() => {
    const measure = () => {
      const g = meter.current;
      if (!g) return;
      widths.current = [...g.querySelectorAll("text")].map((t) => t.getComputedTextLength());
      set(pos.current);
    };
    measure();
    let live = true;
    document.fonts?.ready.then(() => live && measure());
    return () => {
      live = false;
    };
  }, [names, w, set]);

  useLayoutEffect(() => set(pos.current), [cur, w, set]);

  const ks: number[] = [];
  if (n) for (let k = cur - 3; k <= cur + 3; k++) if (loop || (k >= 0 && k < n)) ks.push(k);
  const name = (k: number) => names[mod(k, n)] ?? "";

  return (
    <div ref={box} className="relative w-full text-ink" style={{ height: H }}>
      {w > 0 && (
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true" className="block select-none font-sans" style={{ WebkitMaskImage: FADE, maskImage: FADE }}>
          <defs>
            <path id={arc} d={d} />
          </defs>
          <g ref={meter} visibility="hidden">
            {names.map((s, i) => (
              <text key={i} style={TEXT}>{dialName(s)}</text>
            ))}
          </g>
          {ks.map((k) => (
            <text
              key={k}
              ref={(el) => {
                const path = el?.firstElementChild as SVGTextPathElement | null | undefined;
                if (el && path) labels.current.set(k, { text: el, path });
                else labels.current.delete(k);
              }}
              textAnchor="middle"
              fill="currentColor"
              style={{ ...TEXT, opacity: 0 }}
            >
              <textPath href={`#${arc}`} startOffset={L / 2}>{dialName(name(k))}</textPath>
            </text>
          ))}
        </svg>
      )}
      {n > 0 && (
        <p className="sr-only" aria-live="polite">
          {name(cur)}, {mod(cur, n) + 1} of {n} in your watchlist
        </p>
      )}
    </div>
  );
});
