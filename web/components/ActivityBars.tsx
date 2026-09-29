"use client";

import { useId, useMemo, useState } from "react";

import { useWidth } from "@/lib/chart";
import type { FeedRow } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/**
 * Trades per month: purchases rise above the baseline, sales hang below it
 * (diverging, one axis). Bars grow in; hover or tap shows the counts. The
 * legend names both directions, so colour is never the only cue.
 */
export function ActivityBars({ rows, months = 12, height = 150 }: { rows: FeedRow[]; months?: number; height?: number }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");

  const data = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTHS[d.getMonth()], year: d.getFullYear(), buys: 0, sells: 0 };
    });
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    for (const r of rows) {
      const date = r.txnDate ?? r.disclosedAt;
      if (!date) continue;
      const i = index.get(date.slice(0, 7));
      if (i == null) continue;
      if (r.txnType === "buy") buckets[i].buys++;
      else if (r.txnType === "sell") buckets[i].sells++;
    }
    return buckets;
  }, [rows, months]);

  const max = Math.max(1, ...data.map((d) => Math.max(d.buys, d.sells)));
  const mid = height / 2;
  const slot = width / data.length;
  const barW = Math.max(8, Math.min(24, slot * 0.58));
  // Cylinders seen slightly from above: an elliptical cap at the end away
  // from the baseline, a body lit from the left, a soft shadow on the card.
  const capRy = Math.max(2, barW * 0.2);
  const h = (v: number) => (v / max) * (mid - 16 - capRy);
  const total = data.reduce((a, d) => a + d.buys + d.sells, 0);
  if (total === 0) {
    return <p className="py-6 text-center text-[14px] text-subtle">Keine Käufe oder Verkäufe in den letzten {months} Monaten.</p>;
  }

  const cur = hover != null ? data[hover] : null;
  const body = (tone: "bull" | "bear") => (
    <linearGradient id={`${gid}-${tone}`} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor={`rgb(var(--${tone}-deep))`} />
      <stop offset="32%" stopColor={`rgb(var(--${tone}-hi))`} />
      <stop offset="62%" stopColor={`rgb(var(--${tone}-fill))`} />
      <stop offset="100%" stopColor={`rgb(var(--${tone}-deep))`} />
    </linearGradient>
  );

  return (
    <div>
      <div
        ref={ref}
        className="relative select-none"
        style={{ height }}
        role="img"
        aria-label={`Trades pro Monat, letzte ${months} Monate: ${data.map((d) => `${d.label} ${d.buys} Käufe, ${d.sells} Verkäufe`).join("; ")}.`}
        onPointerLeave={() => setHover(null)}
      >
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            {body("bull")}
            {body("bear")}
            <radialGradient id={`${gid}-cap-bull`} cx="40%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
              <stop offset="100%" stopColor="rgb(var(--bull-hi))" />
            </radialGradient>
            <radialGradient id={`${gid}-cap-bear`} cx="40%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="rgb(var(--bear-hi))" />
            </radialGradient>
            <filter id={`${gid}-shadow`} x="-50%" y="-20%" width="200%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.18" />
            </filter>
          </defs>
          <line x1={0} x2={width} y1={mid} y2={mid} className="stroke-ink/15" strokeWidth="1" />
          {data.map((d, i) => {
            const cx = slot * i + slot / 2;
            const x = cx - barW / 2;
            const dim = hover != null && hover !== i;
            const up = h(d.buys);
            const down = h(d.sells);
            return (
              <g key={d.key} opacity={dim ? 0.35 : 1} style={{ transition: "opacity 200ms" }} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                <rect x={slot * i} y={0} width={slot} height={height} fill="transparent" />
                {d.buys > 0 && (
                  <g className="rise-y" style={{ animationDelay: `${i * 35}ms` }} filter={`url(#${gid}-shadow)`}>
                    <rect x={x} y={mid - 1 - up} width={barW} height={up} fill={`url(#${gid}-bull)`} />
                    <ellipse cx={cx} cy={mid - 1} rx={barW / 2} ry={capRy} fill={`url(#${gid}-bull)`} />
                    <ellipse cx={cx} cy={mid - 1 - up} rx={barW / 2} ry={capRy} fill={`url(#${gid}-cap-bull)`} />
                  </g>
                )}
                {d.sells > 0 && (
                  <g className="rise-y" style={{ animationDelay: `${i * 35}ms`, transformOrigin: "top" }} filter={`url(#${gid}-shadow)`}>
                    <rect x={x} y={mid + 1} width={barW} height={down} fill={`url(#${gid}-bear)`} />
                    <ellipse cx={cx} cy={mid + 1 + down} rx={barW / 2} ry={capRy} fill={`url(#${gid}-bear)`} />
                    <ellipse cx={cx} cy={mid + 1} rx={barW / 2} ry={capRy} fill={`url(#${gid}-cap-bear)`} opacity="0.85" />
                  </g>
                )}
                <text x={cx} y={height - 1} textAnchor="middle" className="fill-subtle text-[10px]">{d.label}</text>
              </g>
            );
          })}
        </svg>
        {cur && hover != null && (
          <div className="glass pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-2xl px-3 py-1.5 text-[12px]" style={{ left: Math.min(Math.max(slot * hover + slot / 2, 70), width - 70) }}>
            <span className="font-semibold">{cur.label} {cur.year}</span>
            <span className="text-bull"> · ▲ {cur.buys} Käufe</span>
            <span className="text-bear"> · ▼ {cur.sells} Verkäufe</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-4 text-[13px] text-subtle">
        <span className="flex items-center gap-1.5"><i className="dot-3d" style={{ ["--c" as string]: "rgb(var(--bull-fill))" }} />Käufe</span>
        <span className="flex items-center gap-1.5"><i className="dot-3d" style={{ ["--c" as string]: "rgb(var(--bear-fill))" }} />Verkäufe</span>
        <span className="ml-auto">letzte {months} Monate</span>
      </div>
    </div>
  );
}
