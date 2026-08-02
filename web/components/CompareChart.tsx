"use client";

// Indexed performance chart (start = 100) with an interactive crosshair:
// hover shows the date, your ABSOLUTE portfolio value at that point and the
// %-performance of both series — getquin-style.
import { useRef, useState } from "react";

import { abbrevMoney, formatDate } from "@/lib/format";
import { PriceBar } from "@/lib/types";

export function CompareChart({
  a,
  b,
  labelA,
  labelB,
  height = 190,
}: {
  a: PriceBar[];
  b: PriceBar[] | null;
  labelA: string;
  labelB: string | null;
  height?: number;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  if (!a || a.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-subtle">
        Noch nicht genug Kursdaten für einen Verlauf.
      </div>
    );
  }

  const width = 640;
  const pad = 8;
  const baseA = a[0].close || 1;
  const na = a.map((x) => (x.close / baseA) * 100);
  const nb = b && b.length > 1 ? b.map((x) => (x.close / (b[0].close || 1)) * 100) : null;

  const all = nb ? [...na, ...nb] : na;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;

  const xAt = (i: number, len: number) => pad + (i / (len - 1)) * (width - 2 * pad);
  const yAt = (v: number) => pad + (1 - (v - min) / span) * (height - 2 * pad);
  const toPts = (vals: number[]) => vals.map((v, i) => `${xAt(i, vals.length)},${yAt(v)}`).join(" ");

  const endA = na[na.length - 1] - 100;
  const colA = endA >= 0 ? "#16a34a" : "#dc2626";
  const endB = nb ? nb[nb.length - 1] - 100 : null;

  const handleMove = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const rel = (clientX - box.left) / box.width;
    setIdx(Math.max(0, Math.min(na.length - 1, Math.round(rel * (na.length - 1)))));
  };

  // hover values
  const hi = idx ?? na.length - 1;
  const hoverA = na[hi] - 100;
  const bi = nb ? Math.min(nb.length - 1, Math.round((hi / (na.length - 1)) * (nb.length - 1))) : null;
  const hoverB = nb && bi != null ? nb[bi] - 100 : null;
  const tipLeft = idx != null ? Math.min(66, Math.max(2, (idx / (na.length - 1)) * 100)) : 0;

  return (
    <div>
      {/* Readout row (updates on hover) */}
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-xl font-semibold tracking-tight">{abbrevMoney(a[hi].close)}</span>
        <span className={`text-sm font-semibold ${hoverA >= 0 ? "text-bull" : "text-bear"}`}>
          {hoverA >= 0 ? "+" : ""}
          {hoverA.toFixed(1)} %
        </span>
        {hoverB != null && labelB && (
          <span className="text-xs text-subtle">
            {labelB}:{" "}
            <span className={`font-semibold ${hoverB >= 0 ? "text-bull" : "text-bear"}`}>
              {hoverB >= 0 ? "+" : ""}
              {hoverB.toFixed(1)} %
            </span>
          </span>
        )}
        <span className="text-xs text-subtle">{formatDate(a[hi].date)}</span>
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
          <line
            x1={pad}
            x2={width - pad}
            y1={yAt(100)}
            y2={yAt(100)}
            stroke="#e6e8ec"
            strokeDasharray="4 4"
          />
          {nb && (
            <polyline
              points={toPts(nb)}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.8"
              strokeDasharray="5 4"
              strokeLinejoin="round"
            />
          )}
          <polyline
            points={toPts(na)}
            fill="none"
            stroke={colA}
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {idx != null && (
            <g>
              <line
                x1={xAt(idx, na.length)}
                x2={xAt(idx, na.length)}
                y1={pad}
                y2={height - pad}
                stroke="#94a3b8"
                strokeDasharray="3 3"
              />
              <circle
                cx={xAt(idx, na.length)}
                cy={yAt(na[idx])}
                r="4.5"
                fill={colA}
                stroke="#fff"
                strokeWidth="2"
              />
              {nb && bi != null && (
                <circle
                  cx={xAt(idx, na.length)}
                  cy={yAt(nb[bi])}
                  r="3.5"
                  fill="#94a3b8"
                  stroke="#fff"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>
        {idx != null && (
          <div
            className="pointer-events-none absolute -top-1 rounded-xl bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur"
            style={{ left: `${tipLeft}%` }}
          >
            {formatDate(a[idx].date)} · {abbrevMoney(a[idx].close)} ·{" "}
            <span className={hoverA >= 0 ? "text-emerald-300" : "text-rose-300"}>
              {hoverA >= 0 ? "+" : ""}
              {hoverA.toFixed(1)} %
            </span>
            {hoverB != null && (
              <span className="text-slate-300">
                {" "}
                | {labelB} {hoverB >= 0 ? "+" : ""}
                {hoverB.toFixed(1)} %
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1 w-5 rounded-full" style={{ backgroundColor: colA }} />
          <span className="font-medium text-ink">{labelA}</span>
          <span className="font-semibold" style={{ color: colA }}>
            {endA >= 0 ? "+" : ""}
            {endA.toFixed(1)} %
          </span>
        </span>
        {nb && labelB && endB !== null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-5 border-t-2 border-dashed border-slate-400" />
            <span className="text-subtle">{labelB}</span>
            <span className="font-semibold text-slate-500">
              {endB >= 0 ? "+" : ""}
              {endB.toFixed(1)} %
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
