"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { formatDate } from "@/lib/format";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  points: { date: string; value: number }[];
  /** Gestrichelt zeichnen (für Benchmarks). */
  dashed?: boolean;
  /** Fläche unter der Linie füllen (Hauptserie). */
  fill?: boolean;
  /** Treppenlinie statt Interpolation (für zugeführtes Kapital). */
  step?: boolean;
}

const PAD_L = 6;
const PAD_R = 52;
const PAD_T = 12;

/** Wert je Datum, vorwärts fortgeschrieben auf das Achsenraster der Hauptserie. */
function align(series: ChartSeries, dates: string[]): (number | null)[] {
  const m = new Map(series.points.map((p) => [p.date, p.value]));
  const out: (number | null)[] = [];
  let last: number | null = null;
  const first = series.points[0]?.date;
  for (const d of dates) {
    const v = m.get(d);
    if (v !== undefined) last = v;
    out.push(first !== undefined && d >= first ? last : null);
  }
  return out;
}

function path(
  xs: number[],
  ys: (number | null)[],
  step: boolean,
): string {
  let d = "";
  let open = false;
  for (let i = 0; i < ys.length; i++) {
    const y = ys[i];
    if (y === null) {
      open = false;
      continue;
    }
    if (!open) {
      d += `M${xs[i].toFixed(1)},${y.toFixed(1)}`;
      open = true;
    } else if (step) {
      d += `H${xs[i].toFixed(1)}V${y.toFixed(1)}`;
    } else {
      d += `L${xs[i].toFixed(1)},${y.toFixed(1)}`;
    }
  }
  return d;
}

export function DepotChart({
  series,
  height = 240,
  format,
  formatAxis,
  /** Nulllinie einzeichnen (Drawdown / Prozentansicht). */
  zeroLine = false,
  /** Kopfzeile mit Live-Werten beim Überfahren. */
  header = true,
}: {
  series: ChartSeries[];
  height?: number;
  format: (v: number) => string;
  formatAxis?: (v: number) => string;
  zeroLine?: boolean;
  header?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    setW(Math.max(280, el.getBoundingClientRect().width || 720));
    return () => ro.disconnect();
  }, []);

  const main = series[0];
  const dates = useMemo(() => main?.points.map((p) => p.date) ?? [], [main]);

  const geom = useMemo(() => {
    if (!main || dates.length < 2) return null;
    const aligned = series.map((s) => align(s, dates));
    const flat = aligned.flat().filter((v): v is number => v !== null);
    if (flat.length === 0) return null;

    let lo = Math.min(...flat);
    let hi = Math.max(...flat);
    if (zeroLine) {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, 0);
    }
    if (hi === lo) {
      hi += Math.abs(hi) * 0.05 || 1;
      lo -= Math.abs(lo) * 0.05 || 1;
    }
    const span = hi - lo;
    lo -= span * 0.08;
    hi += span * 0.08;

    const innerW = w - PAD_L - PAD_R;
    const innerH = height - PAD_T - 22;
    const xs = dates.map((_, i) => PAD_L + (i / (dates.length - 1)) * innerW);
    const y = (v: number) => PAD_T + innerH - ((v - lo) / (hi - lo)) * innerH;
    const ysAll = aligned.map((a) => a.map((v) => (v === null ? null : y(v))));

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (hi - lo));
    return { aligned, xs, ysAll, y, lo, hi, innerH, ticks, baseY: y(0) };
  }, [series, dates, w, height, zeroLine, main]);

  if (!main || !geom || dates.length < 2) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-subtle">
        Nicht genug Kursdaten für einen Verlauf.
      </div>
    );
  }

  const { aligned, xs, ysAll, ticks, y, innerH } = geom;
  const lastIdx = dates.length - 1;
  const idx = hover ?? lastIdx;
  const fmtAxis = formatAxis ?? format;

  const onMove = (clientX: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const rel = clientX - r.left - PAD_L;
    const innerW = w - PAD_L - PAD_R;
    const i = Math.round((rel / innerW) * (dates.length - 1));
    setHover(Math.max(0, Math.min(dates.length - 1, i)));
  };

  const labelEvery = Math.max(1, Math.floor(dates.length / 5));
  const xLabels = dates
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % labelEvery === 0 && i < dates.length - labelEvery / 2);

  return (
    <div ref={wrapRef} className="w-full select-none">
      {header && (
        <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {series.map((s, si) => {
            const v = aligned[si][idx];
            return (
              <div key={s.key} className="flex items-baseline gap-1.5">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color, opacity: s.dashed ? 0.65 : 1 }}
                />
                <span className="text-[11px] text-subtle">{s.label}</span>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: si === 0 ? undefined : s.color }}
                >
                  {v === null ? "—" : format(v)}
                </span>
              </div>
            );
          })}
          <span className="ml-auto text-[11px] tabular-nums text-subtle">
            {formatDate(dates[idx])}
          </span>
        </div>
      )}

      <svg
        width={w}
        height={height}
        className="block touch-pan-y"
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`dcg-${main.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={main.color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={main.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Raster + Achsenbeschriftung rechts */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={w - PAD_R + 4}
              y1={y(t)}
              y2={y(t)}
              stroke="#e2e8f0"
              strokeWidth={1}
              strokeDasharray={i === 0 || i === ticks.length - 1 ? undefined : "3 4"}
            />
            <text
              x={w - PAD_R + 8}
              y={y(t) + 3.5}
              fontSize={10}
              fill="#94a3b8"
              className="tabular-nums"
            >
              {fmtAxis(t)}
            </text>
          </g>
        ))}

        {zeroLine && (
          <line
            x1={PAD_L}
            x2={w - PAD_R + 4}
            y1={y(0)}
            y2={y(0)}
            stroke="#94a3b8"
            strokeWidth={1}
          />
        )}

        {/* Flächen + Linien, Hauptserie zuletzt damit sie obenauf liegt */}
        {series
          .map((s, si) => ({ s, si }))
          .sort((a, b) => b.si - a.si)
          .map(({ s, si }) => {
            const ys = ysAll[si];
            const d = path(xs, ys, !!s.step);
            if (!d) return null;
            const firstI = ys.findIndex((v) => v !== null);
            const lastI = ys.length - 1 - [...ys].reverse().findIndex((v) => v !== null);
            return (
              <g key={s.key}>
                {s.fill && firstI >= 0 && (
                  <path
                    d={`${d}L${xs[lastI].toFixed(1)},${(PAD_T + innerH).toFixed(1)}L${xs[
                      firstI
                    ].toFixed(1)},${(PAD_T + innerH).toFixed(1)}Z`}
                    fill={`url(#dcg-${main.key})`}
                  />
                )}
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={si === 0 ? 2.1 : 1.5}
                  strokeDasharray={s.dashed ? "5 4" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={si === 0 ? 1 : 0.85}
                />
              </g>
            );
          })}

        {/* Fadenkreuz */}
        {hover !== null && (
          <line
            x1={xs[idx]}
            x2={xs[idx]}
            y1={PAD_T}
            y2={PAD_T + innerH}
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {series.map((s, si) => {
          const yv = ysAll[si][idx];
          if (yv === null) return null;
          return (
            <circle
              key={s.key}
              cx={xs[idx]}
              cy={yv}
              r={si === 0 ? 4 : 3}
              fill="#fff"
              stroke={s.color}
              strokeWidth={2}
            />
          );
        })}

        {/* X-Achse */}
        {xLabels.map(({ d, i }) => (
          <text
            key={d}
            x={xs[i]}
            y={height - 5}
            fontSize={10}
            fill="#94a3b8"
            textAnchor={i === 0 ? "start" : "middle"}
          >
            {d.slice(8, 10)}.{d.slice(5, 7)}.{d.slice(2, 4)}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Balkendiagramm für Jahres- oder Monatsrenditen. */
export function ReturnBars({
  data,
  height = 150,
  formatValue = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} %`,
}: {
  data: { key: string; r: number }[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) {
    return <div className="py-8 text-center text-sm text-subtle">Noch keine volle Periode.</div>;
  }
  const max = Math.max(...data.map((d) => Math.abs(d.r)), 0.02);
  const zeroPct = 50;

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const h = (Math.abs(d.r) / max) * 45;
          const up = d.r >= 0;
          return (
            <div
              key={d.key}
              className="relative flex h-full flex-1 flex-col justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="relative h-full">
                <div className="absolute inset-x-0" style={{ top: `${zeroPct}%` }}>
                  <div className="h-px bg-slate-200" />
                </div>
                <div
                  className={`absolute inset-x-1 rounded-md transition-all ${
                    up ? "bg-emerald-500" : "bg-rose-500"
                  } ${hover === i ? "opacity-100" : "opacity-85"}`}
                  style={
                    up
                      ? { bottom: `${zeroPct}%`, height: `${h}%` }
                      : { top: `${zeroPct}%`, height: `${h}%` }
                  }
                />
                <div
                  className="absolute inset-x-0 text-center text-[10px] font-semibold tabular-nums"
                  style={
                    up
                      ? { bottom: `calc(${zeroPct}% + ${h}%)`, color: "#15803d" }
                      : { top: `calc(${zeroPct}% + ${h}%)`, color: "#be123c" }
                  }
                >
                  {formatValue(d.r)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2">
        {data.map((d) => (
          <div key={d.key} className="flex-1 text-center text-[11px] text-subtle">
            {d.key}
          </div>
        ))}
      </div>
    </div>
  );
}
