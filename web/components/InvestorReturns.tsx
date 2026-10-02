"use client";

import { useMemo, useRef, useState } from "react";

import { pctOf } from "@/lib/format";
import { MIN_COVERAGE, type ReturnSummary, type YearReturn } from "@/lib/returns";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Signed percent in the gain/loss text colour, with ▲/▼ so colour is never alone. */
function Signed({ v, className = "" }: { v: number | null; className?: string }) {
  if (v === null) return <span className={`text-subtle ${className}`}>—</span>;
  return (
    <span className={`tabular-nums ${v >= 0 ? "text-bull" : "text-bear"} ${className}`}>
      {v >= 0 ? "▲" : "▼"} {pctOf(Math.abs(v), 1, false)}
    </span>
  );
}

function yearLabel(y: YearReturn, first: boolean, from: string): string {
  if (y.current) return `${y.year} so far`;
  if (first && y.months < 12) return `${y.year} from ${MONTHS[Number(from.slice(5, 7)) - 1]}`;
  return String(y.year);
}

/** Clean ticks for a percent axis that always contains zero. */
function ticks(lo: number, hi: number): number[] {
  const span = Math.max(hi - lo, 0.05);
  const step = [0.05, 0.1, 0.2, 0.25, 0.5, 1].find((s) => span / s <= 4) ?? 1;
  const out: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Number(t.toFixed(4)));
  return out;
}

/**
 * Yearly columns: the investor in its aura blue, the S&P 500 in context grey
 * beside it (emphasis, not two equal series). Touch, hover or arrow keys pick
 * a year; the readout above the plot names both values.
 */
function YearlyChart({ years, who }: { years: YearReturn[]; who: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const box = useRef<SVGSVGElement>(null);
  const W = 340;
  const H = 168;
  const top = 8;
  const bottom = 22;
  const left = 34;
  const values = years.flatMap((y) => [y.ret, y.bench ?? 0]);
  const t = ticks(Math.min(0, ...values), Math.max(0, ...values));
  const lo = t[0];
  const hi = t[t.length - 1];
  const y = (v: number) => top + ((hi - v) / (hi - lo)) * (H - top - bottom);
  const band = (W - left) / years.length;
  const bar = Math.min(10, Math.max(4, band * 0.3));
  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((clientX - r.left) / r.width) * W - left;
    setSel(Math.max(0, Math.min(years.length - 1, Math.floor(x / band))));
  };
  // A column with a 4 px rounded data end and a square foot on the zero line.
  const column = (x: number, v: number) => {
    const y0 = y(0);
    const y1 = y(v);
    const h = Math.abs(y1 - y0);
    if (h < 0.5) return `M${x},${y0}h${bar}`;
    const r = Math.min(4, h, bar / 2);
    return v >= 0
      ? `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + bar - r}Q${x + bar},${y1} ${x + bar},${y1 + r}V${y0}Z`
      : `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + bar - r}Q${x + bar},${y1} ${x + bar},${y1 - r}V${y0}Z`;
  };
  const shown = sel ?? years.length - 1;
  const s = years[shown];

  return (
    <div>
      {/* The readout doubles as the legend: a key, the name, the value. */}
      <div className="mb-2 min-h-[2.75rem]" aria-live="polite">
        <div className="text-[13px] font-semibold">{s.current ? `${s.year} so far` : s.year}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-[rgb(var(--aura-investor))]" /><span className="text-subtle">{who}</span><Signed v={s.ret} className="font-semibold" /></span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-[rgb(var(--bench-fill))]" /><span className="text-subtle">S&amp;P 500</span><Signed v={s.bench} /></span>
        </div>
      </div>
      <svg
        ref={box}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-pan-y select-none outline-none"
        data-noswipe=""
        data-sheet-nodrag=""
        role="img"
        aria-label={`Yearly returns of ${who} and the S&P 500`}
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setSel(null); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setSel(Math.max(0, shown - 1));
          if (e.key === "ArrowRight") setSel(Math.min(years.length - 1, shown + 1));
        }}
      >
        {t.map((v) => (
          <g key={v}>
            <line x1={left} x2={W} y1={y(v)} y2={y(v)} stroke="rgb(var(--hair))" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="rgb(var(--subtle))" className="tabular-nums">
              {`${Math.round(v * 100)}%`}
            </text>
          </g>
        ))}
        {years.map((yr, i) => {
          const cx = left + band * i + band / 2;
          const on = i === shown;
          return (
            <g key={yr.year} opacity={sel === null || on ? 1 : 0.45} style={{ transition: "opacity 160ms" }}>
              {on && sel !== null && <rect x={left + band * i} y={top} width={band} height={H - top - bottom} rx={6} fill="rgb(var(--ink) / 0.05)" />}
              <path d={column(cx - bar - 1, yr.ret)} fill="rgb(var(--aura-investor))" />
              {yr.bench !== null && <path d={column(cx + 1, yr.bench)} fill="rgb(var(--bench-fill))" />}
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--subtle))" fontWeight={on ? 600 : 400}>
                {`’${String(yr.year).slice(2)}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * What copying an investor's 13F filings would have returned, year by year,
 * next to the S&P 500 over the same months (after Eaves's CAGR figure).
 */
export function InvestorReturns({ returns, who }: { returns: ReturnSummary; who: string }) {
  const [all, setAll] = useState(false);
  const years = useMemo(() => [...returns.yearly].reverse(), [returns.yearly]);
  const low = returns.coverage !== null && returns.coverage < MIN_COVERAGE;
  const shownYears = all ? years : years.slice(0, 5);
  const longRun = returns.cagr !== null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Returns</h2>
      <div className="card space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[13px] text-subtle">{longRun ? `Per year since ${monthName(returns.from)}` : `Since ${monthName(returns.from)}`}</div>
            <div className="mt-0.5 font-display text-[28px] font-bold leading-tight tracking-[-0.02em]"><Signed v={longRun ? returns.cagr : returns.total} /></div>
            <div className="mt-0.5 text-[13px] text-subtle">S&amp;P 500 <Signed v={longRun ? returns.benchCagr : returns.benchTotal} /></div>
          </div>
          <div>
            <div className="text-[13px] text-subtle">Last 12 months</div>
            <div className="mt-0.5 font-display text-[28px] font-bold leading-tight tracking-[-0.02em]"><Signed v={returns.oneYear} /></div>
            <div className="mt-0.5 text-[13px] text-subtle">S&amp;P 500 <Signed v={returns.benchOneYear} /></div>
          </div>
        </div>

        {returns.yearly.length > 1 && <YearlyChart years={returns.yearly} who={who} />}

        <div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-5 border-b border-hair pb-2 text-[12px] font-semibold text-subtle">
            <span>Year</span>
            <span className="w-20 text-right">{who.split(" ").slice(-1)[0]}</span>
            <span className="w-20 text-right">S&amp;P 500</span>
          </div>
          {shownYears.map((y) => (
            <div key={y.year} className="grid grid-cols-[1fr_auto_auto] gap-x-5 border-b border-hair py-2 text-[14px] last:border-b-0">
              <span>{yearLabel(y, y.year === returns.yearly[0].year, returns.from)}</span>
              <Signed v={y.ret} className="w-20 text-right font-semibold" />
              <Signed v={y.bench} className="w-20 text-right" />
            </div>
          ))}
          {years.length > 5 && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 inline-flex min-h-11 items-center text-[14px] font-medium text-subtle hover:text-ink">
              {all ? "Show fewer years" : `Show all ${years.length} years`}
            </button>
          )}
        </div>

        <p className="text-[12px] leading-relaxed text-subtle">
          {low && <strong className="font-semibold text-ink">Only {Math.round((returns.coverage ?? 0) * 100)}% of the reported value could be priced in the last year, so this figure says less than usual. </strong>}
          What holding each 13F’s stock positions from its report date to the next would have returned, dividends included. Not the fund’s own result: trades
          within a quarter, short positions, options, bonds and fees are not in a 13F. Through {monthName(returns.through)}.
        </p>
      </div>
    </section>
  );
}
