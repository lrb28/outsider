"use client";

// Indexed performance (start = 100) of your depot against a benchmark, on
// one axis. Hover, touch or the arrow keys show the date, your absolute
// depot value and both returns. Both lines are labelled in the legend, and
// the change is spelled out with ▲/▼, never colour alone.
import { type KeyboardEvent, useId, useState } from "react";

import { monotonePath, niceTicks, useWidth } from "@/lib/chart";
import { abbrevMoney, formatDate } from "@/lib/format";
import { CAT } from "@/lib/palette";
import type { PriceBar } from "@/lib/types";

const fmtPct = (v: number) => `${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

export function CompareChart({
  a,
  b,
  labelA,
  labelB,
  height = 200,
}: {
  a: PriceBar[];
  b: PriceBar[] | null;
  labelA: string;
  labelB: string | null;
  height?: number;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const { ref, width } = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");

  if (!a || a.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-2xl bg-surface2 text-[13px] text-subtle">
        Not enough price data for a chart yet.
      </div>
    );
  }

  const axisW = 44;
  const plotW = Math.max(40, width - axisW);
  const padY = 12;
  const na = a.map((x) => (x.close / (a[0].close || 1)) * 100);
  const nb = b && b.length > 1 ? b.map((x) => (x.close / (b[0].close || 1)) * 100) : null;
  const all = nb ? [...na, ...nb] : na;
  const lo = Math.min(...all, 100);
  const hi = Math.max(...all, 100);
  const pad = (hi - lo) * 0.08 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const xAt = (i: number, len: number) => (i / (len - 1)) * plotW;
  const yAt = (v: number) => padY + (1 - (v - min) / (max - min)) * (height - 2 * padY);
  const path = (vals: number[]) => monotonePath(vals.map((v, i) => [xAt(i, vals.length), yAt(v)] as [number, number]));
  const lineA = path(na);
  const areaA = `${lineA}L${plotW},${height}L0,${height}Z`;
  const ticks = niceTicks(lo - 100, hi - 100, 3).map((t) => t + 100);

  const colA = CAT[0];
  const colB = "rgb(var(--n-400))";
  const endA = na[na.length - 1] - 100;
  const endB = nb ? nb[nb.length - 1] - 100 : null;

  const at = idx ?? na.length - 1;
  const hoverA = na[at] - 100;
  const bi = nb ? Math.min(nb.length - 1, Math.round((at / (na.length - 1)) * (nb.length - 1))) : null;
  const hoverB = nb && bi != null ? nb[bi] - 100 : null;

  const move = (clientX: number, rect: DOMRect) => {
    const rel = (clientX - rect.left) / Math.min(rect.width, plotW);
    setIdx(Math.max(0, Math.min(na.length - 1, Math.round(rel * (na.length - 1)))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = Math.max(1, Math.round(na.length / 60));
    setIdx((i) => Math.max(0, Math.min(na.length - 1, (i ?? na.length - 1) + (e.key === "ArrowLeft" ? -step : step))));
  };
  const tipX = idx != null ? Math.min(Math.max(xAt(idx, na.length), 90), plotW - 90) : 0;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
        <span className="num-lg">{abbrevMoney(a[at].close)}</span>
        <span className={`text-[15px] font-semibold tabular-nums ${hoverA >= 0 ? "text-bull" : "text-bear"}`}>{fmtPct(hoverA)}</span>
        <span className="text-[13px] text-subtle">{formatDate(a[at].date)}</span>
      </div>

      <div
        ref={ref}
        role="img"
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setIdx(null)}
        aria-label={`${labelA}: ${fmtPct(endA)} since ${formatDate(a[0].date)}${nb && labelB && endB != null ? `, ${labelB}: ${fmtPct(endB)}` : ""}.`}
        className="relative cursor-crosshair touch-none select-none rounded-xl"
        style={{ height }}
        onPointerMove={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setIdx(null)}
      >
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={`${gid}-a`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colA} stopOpacity="0.2" />
              <stop offset="100%" stopColor={colA} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotW} y1={yAt(t)} y2={yAt(t)} className={t === 100 ? "stroke-ink/25" : "stroke-hair"} strokeWidth="1" />
              <text x={plotW + 8} y={yAt(t)} dy="0.32em" className="fill-subtle text-[11px] tabular-nums">{t === 100 ? "0%" : `${t > 100 ? "+" : "−"}${Math.abs(t - 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`}</text>
            </g>
          ))}
          <path d={areaA} fill={`url(#${gid}-a)`} className="fade-in" />
          {nb && <path d={path(nb)} pathLength={1} fill="none" stroke={colB} strokeWidth="1.75" strokeLinejoin="round" className="draw-line" />}
          <path d={lineA} pathLength={1} fill="none" stroke={colA} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" className="draw-line" />
          {idx != null && (
            <g>
              <line x1={xAt(idx, na.length)} x2={xAt(idx, na.length)} y1={0} y2={height} className="stroke-ink/25" strokeWidth="1" />
              {nb && bi != null && <circle cx={xAt(idx, na.length)} cy={yAt(nb[bi])} r="4" fill={colB} className="stroke-card" strokeWidth="2" />}
              <circle cx={xAt(idx, na.length)} cy={yAt(na[idx])} r="5.5" fill={colA} className="stroke-card" strokeWidth="2.5" />
            </g>
          )}
        </svg>
        {idx != null && (
          <div className="glass pointer-events-none absolute -top-3 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-2xl px-3 py-2 text-[12px] text-ink" style={{ left: tipX }}>
            <div className="font-semibold">{formatDate(a[idx].date)} · {abbrevMoney(a[idx].close)}</div>
            <div className="mt-0.5 flex gap-3 tabular-nums">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: colA }} />{fmtPct(hoverA)}</span>
              {hoverB != null && labelB && <span className="flex items-center gap-1 text-subtle"><i className="h-2 w-2 rounded-full" style={{ background: colB }} />{labelB} {fmtPct(hoverB)}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-5 rounded-full" style={{ backgroundColor: colA }} />
          <span className="font-medium text-ink">{labelA}</span>
          <span className={`font-semibold tabular-nums ${endA >= 0 ? "text-bull" : "text-bear"}`}>{fmtPct(endA)}</span>
        </span>
        {nb && labelB && endB !== null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-5 rounded-full" style={{ backgroundColor: colB }} />
            <span className="text-subtle">{labelB}</span>
            <span className="font-semibold tabular-nums text-subtle">{fmtPct(endB)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
