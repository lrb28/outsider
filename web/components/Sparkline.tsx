"use client";

import { useId } from "react";

import { monotonePath, useWidth } from "@/lib/chart";
import type { PriceBar } from "@/lib/types";

// Compact price line (e.g. in the trade sheet): smooth, green or red with a
// soft fill, the disclosure date marked with a hairline and a dot. Draws in.
export function Sparkline({
  bars,
  markDate,
  up = true,
  height = 150,
}: {
  bars: PriceBar[];
  markDate?: string | null;
  up?: boolean;
  width?: number;
  height?: number;
}) {
  const { ref, width } = useWidth<HTMLDivElement>(320);
  const gid = useId().replace(/:/g, "");
  if (!bars || bars.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-2xl bg-surface2 text-[13px] text-subtle">
        Kein Kursverlauf verfügbar.
      </div>
    );
  }

  const pad = 8;
  const closes = bars.map((b) => b.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const n = bars.length;
  const x = (i: number) => (i / (n - 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - 2 * pad);
  const line = monotonePath(bars.map((b, i) => [x(i), y(b.close)] as [number, number]));
  const area = `${line}L${width},${height}L0,${height}Z`;
  const markIdx = markDate ? bars.findIndex((b) => b.date >= markDate) : -1;

  return (
    <div ref={ref} style={{ height, color: `rgb(var(${up ? "--bull-fill" : "--bear-fill"}))` }} aria-hidden="true">
      <svg width={width} height={height} className="block overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} className="fade-in" />
        <path d={line} pathLength={1} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="draw-line" />
        {markIdx >= 0 && (
          <g>
            <line x1={x(markIdx)} y1={0} x2={x(markIdx)} y2={height} className="stroke-ink/20" strokeWidth="1" />
            <circle cx={x(markIdx)} cy={y(bars[markIdx].close)} r="4.5" className="fill-ink stroke-card" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}
