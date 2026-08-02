"use client";

// Interactive price chart: crosshair + floating tooltip on hover/touch, like
// Trade Republic. Shows date, price and change vs the start of the range.
import { useRef, useState } from "react";

import { formatDate } from "@/lib/format";
import { PriceBar } from "@/lib/types";

export function PriceChart({
  bars,
  height = 180,
  formatVal = (v: number) =>
    `$${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
}: {
  bars: PriceBar[];
  height?: number;
  formatVal?: (v: number) => string;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  if (!bars || bars.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-subtle">
        Kein Kursverlauf verfügbar.
      </div>
    );
  }

  const width = 640;
  const pad = 6;
  const closes = bars.map((b) => b.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const n = bars.length;
  const x = (i: number) => pad + (i / (n - 1)) * (width - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - 2 * pad);
  const line = bars.map((b, i) => `${x(i)},${y(b.close)}`).join(" ");
  const area = `${x(0)},${height - pad} ${line} ${x(n - 1)},${height - pad}`;

  const cur = idx != null ? bars[idx] : bars[n - 1];
  const chg = (cur.close - bars[0].close) / (bars[0].close || 1);
  const up = bars[n - 1].close >= bars[0].close;
  const stroke = up ? "#16a34a" : "#dc2626";
  const gid = `pc-${up ? "u" : "d"}`;

  const handleMove = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const rel = (clientX - box.left) / box.width;
    setIdx(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };

  const tipLeft = idx != null ? Math.min(78, Math.max(2, (idx / (n - 1)) * 100)) : 0;

  return (
    <div>
      {/* Value readout above the chart (updates on hover) */}
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xl font-semibold tracking-tight">{formatVal(cur.close)}</span>
        <span className={`text-sm font-semibold ${chg >= 0 ? "text-bull" : "text-bear"}`}>
          {chg >= 0 ? "+" : ""}
          {(chg * 100).toFixed(2)} %
        </span>
        <span className="text-xs text-subtle">{formatDate(cur.date)}</span>
      </div>

      <div
        ref={boxRef}
        className="relative cursor-crosshair touch-none select-none"
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseLeave={() => setIdx(null)}
        onTouchStart={(e) => handleMove(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={() => setIdx(null)}
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gid})`} />
          <polyline
            points={line}
            fill="none"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {idx != null && (
            <g>
              <line
                x1={x(idx)}
                x2={x(idx)}
                y1={pad}
                y2={height - pad}
                stroke="#94a3b8"
                strokeDasharray="3 3"
              />
              <circle cx={x(idx)} cy={y(bars[idx].close)} r="4.5" fill={stroke} stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>
        {idx != null && (
          <div
            className="pointer-events-none absolute -top-1 rounded-xl bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur"
            style={{ left: `${tipLeft}%` }}
          >
            {formatDate(bars[idx].date)} · {formatVal(bars[idx].close)}
          </div>
        )}
      </div>
    </div>
  );
}
