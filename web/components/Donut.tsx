"use client";

import { type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export interface DonutSeg {
  label: string;
  value: number;
  color: string;
}

/** Sanftes Ausrollen: schnell anfangen, weich auslaufen. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Animiert einen Wert von 0 auf `to`. Läuft genau einmal beim Einblenden —
 * beim Wechsel eines Unterreiters wird die Komponente neu eingehängt, also
 * zeichnet sich das Diagramm jedes Mal frisch auf.
 */
function useGrow(to: number, duration = 900, delay = 0, ease = easeOut, enabled = true): number {
  const [v, setV] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    if (!enabled) return;
    // Wer Bewegung im System abgeschaltet hat, bekommt sofort den Endwert.
    if (reducedMotion()) {
      setV(to);
      return;
    }
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts + delay;
      const p = Math.min(1, Math.max(0, (ts - start) / duration));
      setV(to * ease(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [to, duration, delay, ease, enabled]);

  return v;
}

/** True once the element has scrolled into view (and stays true). */
function useSeen<T extends Element>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setSeen(true);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

/** Zahl, die beim Erscheinen hochzählt. Auch einzeln verwendbar. */
export function CountUp({
  to,
  format,
  duration = 900,
  className,
}: {
  to: number;
  format: (v: number) => string;
  duration?: number;
  className?: string;
}) {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  const v = useGrow(to, duration, 0, easeOut, seen);
  return <span ref={ref} className={className}>{format(v)}</span>;
}

type Span = { a0: number; a1: number };

/** Start and end angle (0 = 12 o'clock, clockwise, radians) of each segment. */
function spans(segments: DonutSeg[]): Span[] {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  let a = 0;
  return segments.map((s) => {
    const len = (Math.max(0, s.value) / total) * Math.PI * 2;
    const span = { a0: a, a1: a + len };
    a += len;
    return span;
  });
}

/**
 * Keeps the drawn angles in step with the data: sweeps in clockwise on first
 * show, and when the data changes (another tab, a filter) every segment
 * glides from its old arc to its new one instead of the ring redrawing.
 */
function useSpans(segments: DonutSeg[], seen: boolean): { spans: Span[]; sweep: number } {
  const target = spans(segments);
  const key = segments.map((s) => `${s.label}:${s.value}`).join("|");
  const [state, setState] = useState<{ spans: Span[]; sweep: number }>({ spans: target, sweep: 0 });
  const shown = useRef<Map<string, Span>>(new Map());
  const first = useRef(true);
  const raf = useRef<number>();

  useIsoLayoutEffect(() => {
    if (!seen) return;
    const labels = segments.map((s) => s.label);
    if (raf.current) cancelAnimationFrame(raf.current);
    if (reducedMotion()) {
      setState({ spans: target, sweep: 1 });
      shown.current = new Map(labels.map((l, i) => [l, target[i]]));
      first.current = false;
      return;
    }
    const from = labels.map((l, i) => shown.current.get(l) ?? { a0: target[i].a0, a1: target[i].a0 });
    const initial = first.current;
    first.current = false;
    let start: number | null = null;
    const duration = initial ? 1150 : 650;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      if (initial) {
        setState({ spans: target, sweep: easeOutExpo(p) });
      } else {
        const e = easeInOut(p);
        const now = target.map((t, i) => ({ a0: from[i].a0 + (t.a0 - from[i].a0) * e, a1: from[i].a1 + (t.a1 - from[i].a1) * e }));
        shown.current = new Map(labels.map((l, i) => [l, now[i]]));
        setState({ spans: now, sweep: 1 });
      }
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else shown.current = new Map(labels.map((l, i) => [l, target[i]]));
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, seen]);

  return state;
}

/**
 * Ring chart. The shares meet edge to edge, one closed band with square
 * joins; each is lit along its length (lighter where it starts, full colour
 * where it ends, so the joins read without gaps) and across the band (a
 * highlight on the outer rim, shade inside), and the ring is lifted by a soft
 * glow in its own colours. It sweeps in clockwise when it scrolls into view,
 * glides to new values, and the segment under the finger or pointer grows
 * and steps out.
 */
export function Donut({
  segments,
  size = 150,
  thickness = 18,
  centerTop,
  centerBottom,
  /** Zahl, die in der Mitte hochzählen soll (statt centerTop). */
  countTo,
  countFormat,
  /** Index des hervorgehobenen Segments — es tritt leicht hervor. */
  activeIndex = null,
  onHover,
  label,
}: {
  segments: DonutSeg[];
  size?: number;
  thickness?: number;
  centerTop?: string;
  centerBottom?: string;
  countTo?: number;
  countFormat?: (v: number) => string;
  activeIndex?: number | null;
  onHover?: (i: number | null) => void;
  /** Accessible summary; defaults to the segments and their values. */
  label?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const PAD = 10; // room for the glow and the grown, stepped-out segment
  const W = size + PAD * 2;
  const c = W / 2;
  const r = (size - thickness - 6) / 2;
  const [host, seen] = useSeen<HTMLDivElement>();
  const { spans: drawn, sweep } = useSpans(segments, seen);
  const count = useGrow(countTo ?? 0, 1000, 0, easeOut, seen);
  const sweepAngle = sweep * Math.PI * 2;
  // Each segment reaches a hair under the next one, so no seam of the card
  // shows through the antialiased joins.
  const overlap = 0.6 / r;

  const pt = (a: number, rad = r) => [c + rad * Math.sin(a), c - rad * Math.cos(a)] as const;
  const arc = (a0: number, a1: number) => {
    if (a1 - a0 >= Math.PI * 2 - 1e-4) {
      const [x0, y0] = pt(0);
      const [x1, y1] = pt(Math.PI);
      return `M${x0} ${y0}A${r} ${r} 0 1 1 ${x1} ${y1}A${r} ${r} 0 1 1 ${x0} ${y0}`;
    }
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };

  // Visible part of each segment, clipped by the entry sweep.
  const visible = segments.map((s, i) => {
    const sp = drawn[i] ?? { a0: 0, a1: 0 };
    if (s.value <= 0 || sp.a1 - sp.a0 <= 1e-4) return null;
    const a0 = sp.a0;
    if (a0 > sweepAngle) return null;
    const a1 = Math.min(sp.a1 + (sp.a1 < Math.PI * 2 - 1e-3 ? overlap : 0), sweepAngle);
    return { a0, a1, mid: (sp.a0 + Math.min(sp.a1, sweepAngle)) / 2 };
  });

  const total = segments.reduce((a, s) => a + s.value, 0);
  const summary = label ?? segments.map((s) => `${s.label}: ${s.value}`).join(", ");
  const top = countTo !== undefined && countFormat ? countFormat(count) : centerTop;

  return (
    <div ref={host} className="relative shrink-0" style={{ width: W, height: W, margin: -PAD }}>
      <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} role="img" aria-label={summary} onMouseLeave={() => onHover?.(null)} className="overflow-visible">
        <defs>
          {visible.map((v, i) => {
            if (!v) return null;
            const [x0, y0] = pt(v.a0);
            const [x1, y1] = pt(v.a1 + 1e-3);
            return (
              <linearGradient key={i} id={`${gid}-g${i}`} gradientUnits="userSpaceOnUse" x1={x0} y1={y0} x2={x1} y2={y1}>
                <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.06" />
                <stop offset="1" stopColor="#000" stopOpacity="0.14" />
              </linearGradient>
            );
          })}
          {/* Across the band: a highlight along the outer rim, shade inside. */}
          <radialGradient id={`${gid}-rim`} gradientUnits="userSpaceOnUse" cx={c} cy={c} r={r + thickness / 2 + 4}>
            <stop offset={(r - thickness / 2) / (r + thickness / 2 + 4)} stopColor="#000" stopOpacity="0.16" />
            <stop offset={(r + thickness * 0.1) / (r + thickness / 2 + 4)} stopColor="#fff" stopOpacity="0" />
            <stop offset={(r + thickness * 0.42) / (r + thickness / 2 + 4)} stopColor="#fff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <filter id={`${gid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={Math.max(4, thickness * 0.38)} />
          </filter>
        </defs>

        {/* Track */}
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={thickness} />

        {/* Coloured glow under the ring: it seems to float above the card. */}
        <g filter={`url(#${gid}-glow)`} opacity="0.42" transform={`translate(0 ${thickness * 0.28})`} aria-hidden="true">
          {visible.map((v, i) => v && <path key={i} d={arc(v.a0, v.a1)} fill="none" stroke={segments[i].color} strokeWidth={thickness * 0.8} opacity={activeIndex === null || activeIndex === i ? 1 : 0.3} />)}
        </g>

        {visible.map((v, i) => {
          if (!v) return null;
          const active = activeIndex === i;
          const dim = activeIndex !== null && !active;
          const [dx, dy] = [Math.sin(v.mid) * 3.5, -Math.cos(v.mid) * 3.5];
          const w = active ? thickness + 5 : thickness;
          const d = arc(v.a0, v.a1);
          return (
            <g
              key={i}
              style={{
                transform: active ? `translate(${dx}px, ${dy}px)` : "translate(0, 0)",
                opacity: dim ? 0.38 : 1,
                transition: "transform 380ms cubic-bezier(0.32, 0.72, 0, 1), opacity 220ms ease",
                cursor: onHover ? "pointer" : undefined,
              }}
              onMouseEnter={() => onHover?.(i)}
              onPointerDown={() => onHover?.(active ? null : i)}
            >
              <path d={d} fill="none" stroke={segments[i].color} strokeWidth={w} style={{ transition: "stroke-width 380ms cubic-bezier(0.32, 0.72, 0, 1)" }} />
              <path d={d} fill="none" stroke={`url(#${gid}-g${i})`} strokeWidth={w} pointerEvents="none" style={{ transition: "stroke-width 380ms cubic-bezier(0.32, 0.72, 0, 1)" }} />
              <path d={d} fill="none" stroke={`url(#${gid}-rim)`} strokeWidth={w} pointerEvents="none" style={{ transition: "stroke-width 380ms cubic-bezier(0.32, 0.72, 0, 1)" }} />
            </g>
          );
        })}
      </svg>

      {/* Centre: a real text layer (crisper than SVG text, and it can fade). */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true">
        <div key={`${centerBottom}|${total}`} className="animate-[fadeIn_0.35s_ease-out] px-6">
          {top && (
            <div className="font-display font-bold tabular-nums leading-none tracking-[-0.02em] text-ink" style={{ fontSize: Math.round(size * 0.2) }}>
              {top}
            </div>
          )}
          {centerBottom && (
            <div className="mx-auto mt-1.5 max-w-[7.5rem] truncate text-subtle" style={{ fontSize: Math.max(11, Math.round(size * 0.085)) }}>
              {centerBottom}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
