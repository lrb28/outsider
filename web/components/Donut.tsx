"use client";

import { useEffect, useRef, useState } from "react";

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
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const progress = useGrow(1, 1000);

  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      onMouseLeave={() => onHover?.(null)}
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#eef1f5"
          strokeWidth={thickness}
        />
        {segments.map((s, i) => {
          const full = (s.value / total) * c;
          const len = full * progress;
          const active = activeIndex === i;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={active ? thickness + 5 : thickness}
              strokeDasharray={`${Math.max(0, len)} ${c}`}
              strokeDashoffset={-offset * progress}
              strokeLinecap={segments.length > 1 ? "butt" : "round"}
              opacity={activeIndex === null || active ? 1 : 0.35}
              style={{
                transition: "stroke-width 160ms ease, opacity 160ms ease",
                cursor: onHover ? "pointer" : undefined,
              }}
              onMouseEnter={() => onHover?.(i)}
            />
          );
          offset += full;
          return el;
        })}
      </g>

      {countTo !== undefined && countFormat ? (
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          className="fill-ink tabular-nums"
          style={{ fontSize: size * 0.2, fontWeight: 700 }}
        >
          {countFormat(countTo * progress)}
        </text>
      ) : (
        centerTop && (
          <text
            x="50%"
            y="47%"
            textAnchor="middle"
            className="fill-ink tabular-nums"
            style={{ fontSize: size * 0.2, fontWeight: 700 }}
          >
            {centerTop}
          </text>
        )
      )}
      {centerBottom && (
        <text
          x="50%"
          y="62%"
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
