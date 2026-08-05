"use client";

import { useState } from "react";

// Risiko gegen Ertrag — die eine Sicht, die im Performance-Reiter noch fehlte.

const pctStr = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} %`;

export interface RiskPoint {
  ticker: string;
  name: string;
  /** Annualisierte Schwankung, z. B. 0.35 */
  vol: number;
  /** Rendite gegenüber Einstand, z. B. 3.22 */
  ret: number;
  /** Anteil am Depot (0–1) — bestimmt die Punktgröße. */
  weight: number;
  color: string;
}

/**
 * Risiko gegen Ertrag: links oben ist gut (viel Rendite, wenig Schwankung),
 * rechts unten teuer erkauft. Punktgröße = Gewicht im Depot.
 */
export function RiskReturnMap({ points }: { points: RiskPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const W = 100;
  const H = 100;
  const maxVol = Math.max(...points.map((p) => p.vol), 0.1) * 1.15;
  const rets = points.map((p) => p.ret);
  const maxRet = Math.max(...rets, 0.05);
  const minRet = Math.min(...rets, -0.05);
  const span = maxRet - minRet || 1;

  const x = (v: number) => (v / maxVol) * W;
  const y = (r: number) => H - ((r - minRet) / span) * H;
  const zeroY = y(0);

  return (
    <div className="lcard p-5">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Risiko gegen Ertrag</div>
          <p className="text-[11px] text-subtle">
            Waagerecht die Schwankung, senkrecht die Rendite. Links oben ist der beste Platz.
          </p>
        </div>
        {hover !== null && points[hover] && (
          <div className="text-right">
            <div className="text-sm font-semibold">{points[hover].name}</div>
            <div className="text-[11px] tabular-nums text-subtle">
              Schwankung {(points[hover].vol * 100).toFixed(0)} % · Rendite{" "}
              <span className={points[hover].ret >= 0 ? "text-bull" : "text-bear"}>
                {pctStr(points[hover].ret)}
              </span>
            </div>
          </div>
        )}
      </div>

      <svg viewBox={`-12 -8 ${W + 30} ${H + 24}`} className="mt-2 w-full" style={{ maxHeight: 280 }}>
        {/* Hilfslinien */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={H * f}
            y2={H * f}
            stroke="#e2e8f0"
            strokeWidth={0.4}
            strokeDasharray="2 2"
          />
        ))}
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#94a3b8" strokeWidth={0.7} />
        <text x={W + 2} y={zeroY + 2} fontSize={4} fill="#94a3b8">
          0 %
        </text>
        <text x={W + 2} y={4} fontSize={4} fill="#94a3b8">
          {pctStr(maxRet)}
        </text>
        <text x={0} y={H + 8} fontSize={4} fill="#94a3b8">
          ruhig
        </text>
        <text x={W - 16} y={H + 8} fontSize={4} fill="#94a3b8">
          schwankend
        </text>

        {points.map((p, i) => {
          const r = 2.5 + Math.sqrt(p.weight) * 9;
          const on = hover === i;
          return (
            <g key={p.ticker} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle
                cx={x(p.vol)}
                cy={y(p.ret)}
                r={on ? r * 1.25 : r}
                fill={p.color}
                opacity={hover === null || on ? 0.75 : 0.28}
                style={{ transition: "r 150ms ease, opacity 150ms ease", cursor: "pointer" }}
              />
              {(on || p.weight > 0.12) && (
                <text
                  x={x(p.vol)}
                  y={y(p.ret) - r - 2}
                  fontSize={4}
                  textAnchor="middle"
                  fill="#0f172a"
                  fontWeight={600}
                >
                  {p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
