"use client";

import Link from "next/link";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { CompanyLogo } from "@/components/CompanyLogo";
import { abbrevMoney, companyName, weightPct } from "@/lib/format";
import type { HoldingRow } from "@/lib/types";

/*
 * A portfolio as a small city: the largest positions stand as towers on an
 * isometric plane, height = weight, the company logo on the roof. One series,
 * one colour (the aura of the holder); the faces are only shaded for depth.
 * Pure CSS 3D (no WebGL), so it runs smoothly on phones. Drag to turn the
 * city; it sways gently on its own and holds still for reduced motion. The
 * exact numbers are in the tooltip and in the holdings list below it.
 */

const CELL = 54;
const GAP = 20;
const COLS = 4;
const MAX_H = 150;

type Tower = { key: string; company: string; ticker: string | null; weight: number; value: number | null; row: number; col: number };

export function DepotSkyline({ holdings, aura = "investor", title = "Depot in 3D" }: { holdings: HoldingRow[]; aura?: "investor" | "insider" | "politician"; title?: string }) {
  const towers = useMemo<Tower[]>(() => {
    const top = holdings
      .filter((h) => h.weight != null && h.weight > 0 && !h.putCall)
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, 12);
    const rows = Math.ceil(top.length / COLS);
    // Tallest at the back (smallest row + column) so they do not hide the rest.
    const cells = Array.from({ length: rows * COLS }, (_, i) => ({ row: Math.floor(i / COLS), col: i % COLS }))
      .sort((a, b) => a.row + a.col - (b.row + b.col) || a.row - b.row);
    return top.map((h, i) => ({
      key: `${h.ticker ?? h.securityName}-${i}`,
      company: companyName(h.ticker, h.securityName),
      ticker: h.ticker,
      weight: h.weight ?? 0,
      value: h.value,
      ...cells[i],
    }));
  }, [holdings]);

  const [grown, setGrown] = useState(false);
  const [angle, setAngle] = useState(42);
  const [hover, setHover] = useState<{ t: Tower; x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; a: number } | null>(null);
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

  // A slow sway while nobody is dragging.
  useEffect(() => {
    if (!grown || reduced.current) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (!drag.current) setAngle((a) => a + (42 + Math.sin((now - start) / 2600) * 9 - a) * 0.05);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [grown]);

  if (towers.length < 3) return null;

  const rows = Math.ceil(towers.length / COLS);
  const planeW = COLS * CELL + (COLS - 1) * GAP;
  const planeH = rows * CELL + (rows - 1) * GAP;
  const maxW = towers[0].weight || 1;
  const height = (w: number) => 10 + (w / maxW) * MAX_H;
  const colour = `var(--aura-${aura})`;

  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, a: angle };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    setAngle(Math.max(12, Math.min(78, drag.current.a + (e.clientX - drag.current.x) * 0.35)));
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">{title}</h2>
        <span className="text-[13px] text-subtle">Höhe = Gewicht · ziehen zum Drehen</span>
      </div>
      <div
        ref={box}
        role="img"
        aria-label={`Die ${towers.length} größten Positionen: ${towers.map((t) => `${t.company} ${weightPct(t.weight)}`).join(", ")}.`}
        className="card relative h-[23rem] cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 55% at 50% 62%, rgb(${colour} / 0.16), transparent 70%)` }} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: "1400px", perspectiveOrigin: "50% 20%" }}>
          <div
            className="relative"
            style={{ width: planeW, height: planeH, transformStyle: "preserve-3d", transform: `translateY(56px) rotateX(58deg) rotateZ(${angle}deg)` }}
          >
            {/* Ground shadow */}
            <div aria-hidden="true" className="absolute -inset-6 rounded-[28px]" style={{ background: "rgb(var(--ink) / 0.05)", boxShadow: "0 0 0 1px rgb(var(--ink) / 0.04)" }} />
            {towers.map((t, i) => {
              const h = grown ? height(t.weight) : 2;
              const delay = `${i * 55}ms`;
              const trans = `900ms cubic-bezier(0.32, 0.72, 0, 1) ${delay}`;
              return (
                <div
                  key={t.key}
                  className="absolute"
                  style={{ left: t.col * (CELL + GAP), top: t.row * (CELL + GAP), width: CELL, height: CELL, transformStyle: "preserve-3d" }}
                  onPointerMove={(e) => {
                    const r = box.current?.getBoundingClientRect();
                    if (r) setHover({ t, x: e.clientX - r.left, y: e.clientY - r.top });
                  }}
                >
                  {/* Front face (+y) */}
                  <div
                    className="absolute left-0 w-full origin-bottom"
                    style={{ top: CELL - h, height: h, transform: "rotateX(-90deg)", background: `linear-gradient(180deg, rgb(${colour}) 0%, rgb(${colour} / 0.78) 100%)`, transition: `top ${trans}, height ${trans}` }}
                  />
                  {/* Right face (+x) */}
                  <div
                    className="absolute top-0 h-full origin-right"
                    style={{ left: CELL - h, width: h, transform: "rotateY(90deg)", background: `linear-gradient(90deg, rgb(${colour} / 0.62) 0%, rgb(${colour} / 0.5) 100%)`, filter: "brightness(0.78)", transition: `left ${trans}, width ${trans}` }}
                  />
                  {/* Roof with the logo */}
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-[6px] bg-card"
                    style={{ transform: `translateZ(${h}px)`, boxShadow: `inset 0 0 0 1.5px rgb(${colour} / 0.55)`, transition: `transform ${trans}` }}
                  >
                    <CompanyLogo ticker={t.ticker} company={t.company} size={34} rounded="rounded-[8px]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {hover && (
          <div className="glass pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-2xl px-3 py-2 text-[12px]" style={{ left: hover.x, top: hover.y }}>
            <div className="font-semibold text-ink">{hover.t.company}</div>
            <div className="tabular-nums text-subtle">{weightPct(hover.t.weight)} · {abbrevMoney(hover.t.value)}</div>
          </div>
        )}
      </div>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {towers.slice(0, 6).map((t) =>
          t.ticker ? (
            <Link key={t.key} href={`/stock/${encodeURIComponent(t.ticker)}`} className="chip !min-h-9 shrink-0 !px-3 text-[13px]">
              <span className="font-semibold text-ink">{t.company}</span> <span className="tabular-nums">{weightPct(t.weight)}</span>
            </Link>
          ) : null,
        )}
      </div>
    </section>
  );
}
