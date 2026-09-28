"use client";

import { useMemo, useState } from "react";

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
  const barW = Math.max(6, Math.min(22, slot * 0.56));
  const h = (v: number) => (v / max) * (mid - 14);
  const total = data.reduce((a, d) => a + d.buys + d.sells, 0);
  if (total === 0) return null;

  const cur = hover != null ? data[hover] : null;

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
          <line x1={0} x2={width} y1={mid} y2={mid} className="stroke-ink/20" strokeWidth="1" />
          {data.map((d, i) => {
            const cx = slot * i + slot / 2;
            const dim = hover != null && hover !== i;
            return (
              <g key={d.key} opacity={dim ? 0.35 : 1} style={{ transition: "opacity 200ms" }} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                <rect x={slot * i} y={0} width={slot} height={height} fill="transparent" />
                {d.buys > 0 && (
                  <rect x={cx - barW / 2} y={mid - 1 - h(d.buys)} width={barW} height={h(d.buys)} rx={Math.min(4, barW / 2)} fill="rgb(var(--bull-fill))" className="rise-y" style={{ animationDelay: `${i * 35}ms` }} />
                )}
                {d.sells > 0 && (
                  <rect x={cx - barW / 2} y={mid + 1} width={barW} height={h(d.sells)} rx={Math.min(4, barW / 2)} fill="rgb(var(--bear-fill))" className="rise-y" style={{ animationDelay: `${i * 35}ms`, transformOrigin: "top" }} />
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
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-bull-fill" />Käufe</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-bear-fill" />Verkäufe</span>
      </div>
    </div>
  );
}
