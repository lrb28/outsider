"use client";

import { type KeyboardEvent, useId, useMemo, useState } from "react";

import { RollingNumber } from "@/components/RollingNumber";
import { downsample, monotonePath, niceTicks, useWidth } from "@/lib/chart";
import { formatDate } from "@/lib/format";
import type { PriceBar } from "@/lib/types";

/**
 * Price chart, Apple Stocks style: one smooth line in green or red (the move
 * over the shown range, also spelled out as ▲/▼ and a percentage), a soft
 * glow and gradient beneath it, three recessive gridlines, and a crosshair
 * on hover, touch or the arrow keys. While scrubbing, the price and change
 * above roll to the touched day and its date rides along the top of the
 * crosshair, so nothing in the header moves around. It draws itself in on
 * load.
 */
export function PriceChart({
  bars,
  height = 200,
  formatVal = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  markDate,
  markLabel = "Filed",
  size = "lg",
}: {
  bars: PriceBar[];
  height?: number;
  formatVal?: (v: number) => string;
  /** Optional event to mark on the line (e.g. a disclosure date). */
  markDate?: string | null;
  markLabel?: string;
  /** Size of the price above the chart ("md" inside sheets). */
  size?: "lg" | "md";
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const { ref, width } = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  const data = useMemo(() => downsample(bars ?? [], (b) => b.close, 420), [bars]);

  if (!data || data.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-2xl bg-surface2 text-[13px] text-subtle">
        No price history available.
      </div>
    );
  }

  const n = data.length;
  const padTop = 26;
  const padBottom = 10;
  const axisW = 52;
  const plotW = Math.max(40, width - axisW);
  const closes = data.map((b) => b.close);
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const pad = (hi - lo) * 0.08 || hi * 0.02 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const x = (i: number) => (i / (n - 1)) * plotW;
  const y = (v: number) => padTop + (1 - (v - min) / (max - min)) * (height - padTop - padBottom);
  const pts = data.map((b, i) => [x(i), y(b.close)] as [number, number]);
  const line = monotonePath(pts);
  const area = `${line}L${x(n - 1)},${height}L0,${height}Z`;
  const ticks = niceTicks(lo, hi, 3).filter((t) => t >= min && t <= max);

  const first = data[0].close;
  const last = data[n - 1].close;
  const up = last >= first;
  const colour = up ? "var(--bull-fill)" : "var(--bear-fill)";
  const cur = idx != null ? data[idx] : data[n - 1];
  const chg = (cur.close - first) / (first || 1);

  const markIdx = markDate ? data.findIndex((b) => b.date >= markDate) : -1;

  const move = (clientX: number, rect: DOMRect) => {
    const rel = (clientX - rect.left) / Math.min(rect.width, plotW);
    setIdx(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const step = Math.max(1, Math.round(n / 60));
    setIdx((i) => {
      const at = i ?? n - 1;
      if (e.key === "Home") return 0;
      if (e.key === "End") return n - 1;
      return Math.max(0, Math.min(n - 1, at + (e.key === "ArrowLeft" ? -step : step)));
    });
  };

  const tipX = idx != null ? Math.min(Math.max(x(idx), 38), plotW - 38) : 0;
  const summary = `Price from ${formatDate(data[0].date)} to ${formatDate(data[n - 1].date)}: from ${formatVal(first)} to ${formatVal(last)} (${up ? "up" : "down"} ${Math.abs(((last - first) / (first || 1)) * 100).toFixed(1)} percent), low ${formatVal(lo)}, high ${formatVal(hi)}.`;

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-x-3">
        <RollingNumber value={formatVal(cur.close)} duration={idx != null ? 280 : 650} className={size === "lg" ? "num-xl" : "num-lg"} />
        <span className={`flex items-baseline gap-1 text-[15px] font-semibold transition-colors duration-200 ${chg >= 0 ? "text-bull" : "text-bear"}`}>
          <span aria-hidden="true" className="text-[12px]">{chg >= 0 ? "▲" : "▼"}</span>
          <RollingNumber value={`${Math.abs(chg * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`} duration={idx != null ? 280 : 650} label={`${chg >= 0 ? "up" : "down"} ${Math.abs(chg * 100).toFixed(2)} percent`} />
        </span>
      </div>

      <div
        ref={ref}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setIdx(null)}
        data-sheet-nodrag=""
        className="relative cursor-crosshair touch-none select-none rounded-xl outline-offset-4"
        onPointerMove={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setIdx(null)}
        // A finger lifted ends the reading; a mouse keeps it while hovering.
        onPointerUp={(e) => e.pointerType !== "mouse" && setIdx(null)}
        onPointerCancel={() => setIdx(null)}
        style={{ height, color: `rgb(${colour})` }}
      >
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="70%" stopColor="currentColor" stopOpacity="0.04" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
            <filter id={`${gid}-glow`} x="-5%" y="-30%" width="110%" height="160%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} className="stroke-hair" strokeWidth="1" />
              <text x={plotW + 8} y={y(t)} dy="0.32em" className="fill-subtle text-[11px] tabular-nums">{formatVal(t).replace(/\.00(?=\D*$)/, "")}</text>
            </g>
          ))}

          <path d={area} fill={`url(#${gid}-fill)`} className="fade-in" />
          {/* A blurred copy of the line lifts it off the page. */}
          <path d={line} fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.28" filter={`url(#${gid}-glow)`} className="fade-in" />
          <path d={line} pathLength={1} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" className="draw-line" />

          {/* The disclosure: a quiet band from that day on, no line or dot
              that could pass for a stuck crosshair. */}
          {markIdx >= 0 && (
            <g aria-hidden="true">
              <rect x={x(markIdx)} y={padTop - 8} width={Math.max(0, plotW - x(markIdx))} height={height - padTop + 8} className="fill-ink/[0.04]" />
              <text x={x(markIdx) + 6} y={padTop - 12} className={`fill-subtle text-[11px] font-medium transition-opacity duration-150 ${idx != null ? "opacity-0" : "opacity-100"}`}>{markLabel}</text>
            </g>
          )}

          {/* The latest price breathes. */}
          {idx == null && (
            <g>
              <circle cx={x(n - 1)} cy={y(last)} r="9" fill="currentColor" fillOpacity="0.18" className="animate-live" />
              <circle cx={x(n - 1)} cy={y(last)} r="4" fill="currentColor" className="stroke-card" strokeWidth="2" />
            </g>
          )}

          {idx != null && (
            <g>
              <line x1={x(idx)} x2={x(idx)} y1={18} y2={height} className="stroke-ink/25" strokeWidth="1" />
              <circle cx={x(idx)} cy={y(data[idx].close)} r="5.5" fill="currentColor" className="stroke-card" strokeWidth="2.5" />
            </g>
          )}
        </svg>

        {/* The touched day, riding on top of the crosshair. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap text-[12px] font-semibold tabular-nums text-subtle transition-opacity duration-150 ${idx != null ? "opacity-100" : "opacity-0"}`}
          style={{ left: tipX }}
        >
          {idx != null ? formatDate(data[idx].date) : ""}
        </div>
        <span className="sr-only" aria-live="polite">{idx != null ? `${formatDate(cur.date)}: ${formatVal(cur.close)}` : ""}</span>
      </div>
    </div>
  );
}
