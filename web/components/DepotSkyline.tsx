"use client";

import Link from "next/link";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { CompanyLogo } from "@/components/CompanyLogo";
import { Icon } from "@/components/Icon";
import { abbrevMoney, companyName, fixTicker, stockHref, weightPct } from "@/lib/format";
import type { FeedRow, HoldingRow } from "@/lib/types";

/*
 * "Allocation": a portfolio as a small city. The eight largest positions
 * stand as towers on an isometric plane, height = weight, the company logo on
 * the roof, each in its own categorical colour (the legend below repeats
 * them). Everything else is folded into "Others" in the legend, so the list
 * adds up to the whole portfolio.
 *
 * Touch a tower (or its legend row) to learn more: it lifts, the others
 * step back, and a panel names its weight, value, shares, rank and what the
 * fund did with it last quarter, with a link to the stock. Drag sideways to
 * turn the city; it sways gently on its own and holds still for reduced
 * motion. Pure CSS 3D (no WebGL), so it runs smoothly on phones.
 */

const CELL = 58;
const GAP = 22;
const COLS = 3;
const MAX_H = 150;
const TOWERS = 8;

type Tower = {
  key: string;
  company: string;
  ticker: string | null;
  weight: number;
  value: number | null;
  shares: number | null;
  rank: number;
  colour: string;
  row: number;
  col: number;
};

export function DepotSkyline({ holdings, trades = [], title = "Allocation" }: { holdings: HoldingRow[]; trades?: FeedRow[]; title?: string }) {
  const { towers, others, othersWeight } = useMemo(() => {
    const ranked = holdings
      .filter((h) => h.weight != null && h.weight > 0 && !h.putCall)
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    const top = ranked.slice(0, TOWERS);
    const rows = Math.ceil(top.length / COLS);
    // Tallest at the back (smallest row + column) so they do not hide the rest.
    const cells = Array.from({ length: rows * COLS }, (_, i) => ({ row: Math.floor(i / COLS), col: i % COLS }))
      .sort((a, b) => a.row + a.col - (b.row + b.col) || a.row - b.row);
    const list: Tower[] = top.map((h, i) => ({
      key: `${h.ticker ?? h.securityName}-${i}`,
      company: companyName(h.ticker, h.securityName),
      ticker: h.ticker,
      weight: h.weight ?? 0,
      value: h.value,
      shares: h.shares,
      rank: i + 1,
      colour: `var(--cat-${i + 1})`,
      ...cells[i],
    }));
    const shown = list.reduce((a, t) => a + t.weight, 0);
    return { towers: list, others: Math.max(0, ranked.length - list.length), othersWeight: Math.max(0, 1 - shown) };
  }, [holdings]);

  // What the fund did with each stock in the latest quarter.
  const moveOf = useMemo(() => {
    const m = new Map<string, "buy" | "sell">();
    for (const t of trades) if (t.ticker && (t.txnType === "buy" || t.txnType === "sell") && !t.putCall && !m.has(t.ticker)) m.set(t.ticker, t.txnType);
    return m;
  }, [trades]);

  const [grown, setGrown] = useState(false);
  const [angle, setAngle] = useState(42);
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<{ t: Tower; x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; a: number; tower: string | null; moved: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setGrown(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // A slow sway while nobody is dragging or reading a tower.
  useEffect(() => {
    if (!grown || reduced.current || picked) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (!drag.current) setAngle((a) => a + (42 + Math.sin((now - start) / 2600) * 9 - a) * 0.05);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [grown, picked]);

  if (towers.length < 3) return null;

  const rows = Math.ceil(towers.length / COLS);
  const planeW = COLS * CELL + (COLS - 1) * GAP;
  const planeH = rows * CELL + (rows - 1) * GAP;
  const maxW = towers[0].weight || 1;
  const height = (w: number) => 10 + (w / maxW) * MAX_H;
  const current = towers.find((t) => t.key === picked) ?? null;
  const toggle = (key: string) => setPicked((p) => (p === key ? null : key));

  const onDown = (e: PointerEvent) => {
    const tower = (e.target as Element).closest<HTMLElement>("[data-tower]")?.dataset.tower ?? null;
    drag.current = { x: e.clientX, y: e.clientY, a: angle, tower, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
    if (d.moved) setAngle(Math.max(12, Math.min(78, d.a + (e.clientX - d.x) * 0.35)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    // A touch that did not turn the city picks the tower under it (or lets go).
    if (d && !d.moved) {
      if (d.tower) toggle(d.tower);
      else setPicked(null);
    }
  };
  const move = current?.ticker ? moveOf.get(current.ticker) : undefined;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">{title}</h2>
        <span className="text-[13px] text-subtle">Height = weight · tap a tower</span>
      </div>
      <div className="card overflow-hidden">
        <div
          ref={box}
          role="img"
          aria-label={`The ${towers.length} largest positions: ${towers.map((t) => `${t.company} ${weightPct(t.weight)}`).join(", ")}.`}
          className="relative h-[22rem] cursor-grab touch-pan-y select-none active:cursor-grabbing"
          data-noswipe=""
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => (drag.current = null)}
          onPointerLeave={() => setHover(null)}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-[background] duration-500"
            style={{ background: `radial-gradient(60% 55% at 50% 62%, rgb(${current ? current.colour : "var(--ink)"} / ${current ? 0.2 : 0.05}), transparent 70%)` }}
          />
          <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: "1400px", perspectiveOrigin: "50% 20%" }}>
            <div className="relative" style={{ width: planeW, height: planeH, transformStyle: "preserve-3d", transform: `translateY(48px) rotateX(58deg) rotateZ(${angle}deg)` }}>
              {/* Ground */}
              <div aria-hidden="true" className="absolute -inset-6 rounded-[28px]" style={{ background: "rgb(var(--ink) / 0.05)", boxShadow: "0 0 0 1px rgb(var(--ink) / 0.04)" }} />
              {towers.map((t, i) => {
                const on = picked === t.key;
                const dim = picked !== null && !on;
                const h = grown ? height(t.weight) + (on ? 14 : 0) : 2;
                const trans = `700ms cubic-bezier(0.32, 0.72, 0, 1) ${grown && !picked ? i * 55 : 0}ms`;
                const c = t.colour;
                // Opacity on the tower itself would flatten its 3D faces, so
                // each face fades on its own.
                const fade = { opacity: dim ? 0.28 : 1 };
                return (
                  <div
                    key={t.key}
                    data-tower={t.key}
                    className="absolute cursor-pointer"
                    style={{ left: t.col * (CELL + GAP), top: t.row * (CELL + GAP), width: CELL, height: CELL, transformStyle: "preserve-3d" }}
                    onPointerMove={(e) => {
                      if (e.pointerType !== "mouse") return;
                      const r = box.current?.getBoundingClientRect();
                      if (r) setHover({ t, x: e.clientX - r.left, y: e.clientY - r.top });
                    }}
                  >
                    {/* Front face (+y): lit from above */}
                    <div
                      className="absolute left-0 w-full origin-bottom"
                      style={{ top: CELL - h, height: h, transform: "rotateX(-90deg)", background: `linear-gradient(180deg, rgb(${c}) 0%, rgb(${c} / 0.82) 100%)`, boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.35)`, transition: `top ${trans}, height ${trans}, opacity 300ms ease`, ...fade }}
                    />
                    {/* Right face (+x): in shade */}
                    <div
                      className="absolute top-0 h-full origin-right"
                      style={{ left: CELL - h, width: h, transform: "rotateY(90deg)", background: `linear-gradient(90deg, rgb(${c}) 0%, rgb(${c} / 0.85) 100%)`, filter: "brightness(0.72)", transition: `left ${trans}, width ${trans}, opacity 300ms ease`, ...fade }}
                    />
                    {/* Roof with the logo */}
                    <div
                      className="absolute inset-0 flex items-center justify-center rounded-[7px] bg-card"
                      style={{ transform: `translateZ(${h}px)`, boxShadow: `inset 0 0 0 ${on ? 3 : 2}px rgb(${c})`, transition: `transform ${trans}, box-shadow 300ms ease, opacity 300ms ease`, ...fade }}
                    >
                      <CompanyLogo ticker={t.ticker} company={t.company} size={36} rounded="rounded-[8px]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {hover && !current && (
            <div className="glass pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-2xl px-3 py-2 text-[12px]" style={{ left: hover.x, top: hover.y }}>
              <div className="font-semibold text-ink">{hover.t.company}</div>
              <div className="tabular-nums text-subtle">{weightPct(hover.t.weight)} · {abbrevMoney(hover.t.value)}</div>
            </div>
          )}

          {/* What the touched tower stands for. */}
          {current && (
            <div key={current.key} className="glass fade-up absolute inset-x-3 bottom-3 z-10 rounded-[1.4rem] p-3.5" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <CompanyLogo ticker={current.ticker} company={current.company} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{current.company}</div>
                  <div className="truncate text-[13px] text-subtle">
                    #{current.rank} · {fixTicker(current.ticker, current.company) ?? "—"}
                    {move && <span className={move === "buy" ? "text-bull" : "text-bear"}> · {move === "buy" ? "▲ raised last quarter" : "▼ cut last quarter"}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[20px] font-bold tabular-nums leading-none" style={{ color: `rgb(${current.colour})` }}>{weightPct(current.weight)}</div>
                  <div className="mt-1 text-[12px] text-subtle">of the portfolio</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 border-t border-hair pt-3 text-[13px]">
                <div>
                  <div className="font-semibold tabular-nums">{abbrevMoney(current.value)}</div>
                  <div className="text-[11px] text-subtle">Value</div>
                </div>
                {current.shares != null && (
                  <div>
                    <div className="font-semibold tabular-nums">{current.shares.toLocaleString("en-US")}</div>
                    <div className="text-[11px] text-subtle">Shares</div>
                  </div>
                )}
                {current.ticker && (
                  <Link href={stockHref(current.ticker)} className="btn-primary ml-auto !min-h-10 gap-1 !px-3.5 text-[13px]">
                    Open <Icon name="chevronRight" className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Legend: the same colours, one tap away from each tower. */}
        <ul className="grid grid-cols-1 gap-x-5 border-t border-hair px-2 py-2 sm:grid-cols-2">
          {towers.map((t) => {
            const on = picked === t.key;
            return (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => toggle(t.key)}
                  aria-pressed={on}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[14px] transition-[background,opacity] duration-300 ${on ? "bg-ink/[0.06]" : picked ? "opacity-50" : ""}`}
                >
                  <span className="dot-3d" style={{ ["--c" as string]: `rgb(${t.colour})` }} />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{t.company}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-subtle">{weightPct(t.weight)}</span>
                </button>
              </li>
            );
          })}
          {others > 0 && othersWeight > 0.0005 && (
            <li className="flex min-h-11 items-center gap-2.5 px-2.5 text-[14px]">
              <span className="dot-3d" style={{ ["--c" as string]: "rgb(var(--cat-other))" }} />
              <span className="min-w-0 flex-1 truncate text-subtle">Others ({others.toLocaleString("en-US")})</span>
              <span className="shrink-0 font-semibold tabular-nums text-subtle">{weightPct(othersWeight)}</span>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
