"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface DonutSeg {
  label: string;
  value: number;
  color: string;
}

/** Sanftes Ausrollen: schnell anfangen, weich auslaufen. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animiert einen Wert von 0 auf `to`. Läuft genau einmal beim Einblenden —
 * beim Wechsel eines Unterreiters wird die Komponente neu eingehängt, also
 * zeichnet sich das Diagramm jedes Mal frisch auf.
 */
function useGrow(to: number, duration = 900, delay = 0): number {
  const [v, setV] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    // Wer Bewegung im System abgeschaltet hat, bekommt sofort den Endwert.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setV(to);
      return;
    }
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts + delay;
      const p = Math.min(1, Math.max(0, (ts - start) / duration));
      setV(to * easeOut(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [to, duration, delay]);

  return v;
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
  const v = useGrow(to, duration);
  return <span className={className}>{format(v)}</span>;
}

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
}) {
  const gid = useId().replace(/:/g, "");
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  // Beim Überfahren wächst ein Segment um 5 px. Ohne diesen Rand würde der
  // dickere Ring am Rand der Zeichenfläche abgeschnitten.
  const GROW = 6;
  // The ring is a thick disc seen slightly from above: its side shows as a
  // darker band below it, and a soft shadow grounds it on the card.
  const DEPTH = Math.max(4, Math.round(thickness * 0.3));
  const r = (size - thickness - GROW) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const inner = r - thickness / 2;
  const outer = r + thickness / 2;
  const progress = useGrow(1, 1000);
  const H = size + DEPTH + 6;

  const arcs = (() => {
    let offset = 0;
    return segments.map((s) => {
      const full = (s.value / total) * c;
      // A 2 px gap in the surface colour separates neighbouring segments.
      const len = segments.length > 1 ? Math.max(0, full - 2) * progress : full * progress;
      const arc = { len: Math.max(0, len), off: -offset * progress };
      offset += full;
      return arc;
    });
  })();
  const ring = (i: number, stroke: string, extra: Record<string, unknown> = {}) => {
    const active = activeIndex === i;
    return (
      <circle
        key={i}
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={active ? thickness + 5 : thickness}
        strokeDasharray={`${arcs[i].len} ${c}`}
        strokeDashoffset={arcs[i].off}
        strokeLinecap={segments.length > 1 ? "butt" : "round"}
        {...extra}
      />
    );
  };
  const dim = (i: number) => (activeIndex === null || activeIndex === i ? 1 : 0.35);

  return (
    <svg
      width={size}
      height={H}
      viewBox={`0 0 ${size} ${H}`}
      onMouseLeave={() => onHover?.(null)}
      className="overflow-visible"
    >
      <defs>
        {/* Across the ring: shade at both edges, a highlight just inside the
            middle — the band reads as a rounded tube. */}
        <radialGradient id={`${gid}-tube`} gradientUnits="userSpaceOnUse" cx={cx} cy={cx} r={outer + 3}>
          <stop offset={Math.max(0, inner - 3) / (outer + 3)} stopColor="#000" stopOpacity="0.26" />
          <stop offset={(inner + thickness * 0.38) / (outer + 3)} stopColor="#fff" stopOpacity="0.34" />
          <stop offset={(inner + thickness * 0.62) / (outer + 3)} stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.24" />
        </radialGradient>
        {/* Light from above: brighter top half, darker bottom half. */}
        <linearGradient id={`${gid}-light`} gradientUnits="userSpaceOnUse" x1="0" y1={cx - outer} x2="0" y2={cx + outer}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
        <filter id={`${gid}-blur`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <ellipse cx={cx} cy={cx + outer + DEPTH - 1} rx={outer * 0.86} ry={5} fill="#000" opacity="0.16" filter={`url(#${gid}-blur)`} />

      {/* Side of the disc: the same segments, lower and in shade. */}
      <g transform={`translate(0 ${DEPTH})`}>
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          {segments.map((s, i) => ring(i, s.color, { opacity: dim(i) }))}
          {segments.map((_, i) => ring(i, "#000", { opacity: 0.34 * dim(i), style: { pointerEvents: "none" } }))}
        </g>
      </g>

      <g transform={`rotate(-90 ${cx} ${cx})`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={thickness} />
        {segments.map((s, i) =>
          ring(i, s.color, {
            opacity: dim(i),
            style: { transition: "stroke-width 160ms ease, opacity 160ms ease", cursor: onHover ? "pointer" : undefined },
            onMouseEnter: () => onHover?.(i),
            onPointerDown: () => onHover?.(i),
          }),
        )}
        {segments.map((_, i) => ring(i, `url(#${gid}-tube)`, { opacity: dim(i), style: { pointerEvents: "none", transition: "stroke-width 160ms ease" } }))}
        {segments.map((_, i) => ring(i, `url(#${gid}-light)`, { opacity: dim(i), style: { pointerEvents: "none", transition: "stroke-width 160ms ease" } }))}
      </g>

      {countTo !== undefined && countFormat ? (
        <text
          x={cx}
          y={cx - size * 0.02}
          textAnchor="middle"
          className="fill-ink font-display tabular-nums"
          style={{ fontSize: size * 0.19, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {countFormat(countTo * progress)}
        </text>
      ) : (
        centerTop && (
          <text
            x={cx}
            y={cx - size * 0.02}
            textAnchor="middle"
            className="fill-ink font-display tabular-nums"
            style={{ fontSize: size * 0.19, fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            {centerTop}
          </text>
        )
      )}
      {centerBottom && (
        <text
          x={cx}
          y={cx + size * 0.12}
          textAnchor="middle"
          className="fill-subtle"
          style={{ fontSize: size * 0.09 }}
        >
          {centerBottom}
        </text>
      )}
    </svg>
  );
}
