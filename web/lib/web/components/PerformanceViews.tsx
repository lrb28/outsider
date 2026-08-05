"use client";

import { useMemo, useState } from "react";

import { cAbbrev, cMoney } from "@/lib/money";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** Rot → weiß → grün. `t` läuft von −1 (schlecht) über 0 bis +1 (gut). */
function heatColor(t: number): string {
  const x = Math.max(-1, Math.min(1, t));
  if (x >= 0) {
    // weiß → smaragd
    const a = x;
    return `rgb(${Math.round(255 - 219 * a)}, ${Math.round(255 - 58 * a)}, ${Math.round(255 - 161 * a)})`;
  }
  // weiß → rose
  const a = -x;
  return `rgb(${Math.round(255 - 30 * a)}, ${Math.round(255 - 192 * a)}, ${Math.round(255 - 174 * a)})`;
}

const pctStr = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} %`;

// ── Monats-Heatmap ──────────────────────────────────────────────────────────

/**
 * Kalender der Monatsrenditen: eine Zeile je Jahr, zwölf Spalten. Auf einen
 * Blick sichtbar, in welchen Phasen das Depot gelaufen ist — und wann nicht.
 */
export function MonthHeatmap({
  months,
  years,
}: {
  months: { key: string; r: number }[]; // key = YYYY-MM
  years: { key: string; r: number }[]; // key = YYYY
}) {
  const [hover, setHover] = useState<{ key: string; r: number } | null>(null);

  const grid = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of months) m.set(x.key, x.r);
    const ys = [...new Set(months.map((x) => x.key.slice(0, 4)))].sort();
    return ys.map((y) => ({
      year: y,
      cells: Array.from({ length: 12 }, (_, i) => {
        const key = `${y}-${String(i + 1).padStart(2, "0")}`;
        const r = m.get(key);
        return { key, month: i, r: r === undefined ? null : r };
      }),
      total: years.find((x) => x.key === y)?.r ?? null,
    }));
  }, [months, years]);

  // Skalierung an der tatsächlichen Spannweite, damit kleine Depots nicht
  // durchgehend blass aussehen.
  const scale = useMemo(() => {
    const abs = months.map((x) => Math.abs(x.r)).sort((a, b) => b - a);
    return Math.max(0.03, abs[Math.floor(abs.length * 0.1)] ?? 0.05);
  }, [months]);

  if (grid.length === 0) {
    return <div className="py-8 text-center text-sm text-subtle">Noch keine vollen Monate.</div>;
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <span className="text-sm font-semibold">
          {hover ? pctStr(hover.r) : "Monatsrenditen"}
        </span>
        <span className="text-[11px] text-subtle">
          {hover
            ? `${MONTHS[Number(hover.key.slice(5, 7)) - 1]} ${hover.key.slice(0, 4)}`
            : "Fahr über eine Kachel für den genauen Wert"}
        </span>
      </div>

      <div className="overflow-x-auto" onMouseLeave={() => setHover(null)}>
        <table className="w-full min-w-[34rem] border-separate border-spacing-[3px]">
          <thead>
            <tr>
              <th className="w-10" />
              {MONTHS.map((m) => (
                <th key={m} className="pb-1 text-[10px] font-medium text-subtle">
                  {m}
                </th>
              ))}
              <th className="w-14 pb-1 text-[10px] font-medium text-subtle">Jahr</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.year}>
                <td className="pr-1 text-right text-[11px] font-medium text-subtle">{row.year}</td>
                {row.cells.map((c) => (
                  <td key={c.key}>
                    {c.r === null ? (
                      <div className="h-7 rounded-md bg-slate-50" />
                    ) : (
                      <div
                        className="flex h-7 cursor-default items-center justify-center rounded-md text-[10px] font-semibold tabular-nums transition-transform hover:scale-110"
                        style={{
                          backgroundColor: heatColor(c.r / scale),
                          color: Math.abs(c.r) > scale * 0.6 ? "#0f172a" : "#64748b",
                          outline: hover?.key === c.key ? "2px solid #4f46e5" : undefined,
                        }}
                        onMouseEnter={() => setHover({ key: c.key, r: c.r as number })}
                      >
                        {(c.r * 100).toFixed(0)}
                      </div>
                    )}
                  </td>
                ))}
                <td>
                  <div
                    className={`flex h-7 items-center justify-center rounded-md text-[11px] font-bold tabular-nums ${
                      (row.total ?? 0) >= 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {row.total === null ? "—" : `${(row.total * 100).toFixed(0)}`}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-subtle">
        Werte in Prozent. Die Farbskala richtet sich nach deiner eigenen Schwankungsbreite — nicht
        nach einem festen Maßstab.
      </p>
    </div>
  );
}

// ── Treemap der Positionen ──────────────────────────────────────────────────

export interface TreeItem {
  key: string;
  label: string;
  value: number; // Fläche = Depotanteil
  ret: number | null; // Farbe = Rendite
  gain: number;
}

/** Squarified Treemap — Kacheln bleiben möglichst quadratisch und damit lesbar. */
function squarify(items: TreeItem[], x: number, y: number, w: number, h: number) {
  const out: (TreeItem & { x: number; y: number; w: number; h: number })[] = [];
  const total = items.reduce((a, i) => a + i.value, 0);
  if (total <= 0) return out;

  let rest = [...items];
  let cx = x;
  let cy = y;
  let cw = w;
  let ch = h;
  let scale = (w * h) / total;

  const worst = (row: TreeItem[], len: number) => {
    const sum = row.reduce((a, i) => a + i.value * scale, 0);
    const max = Math.max(...row.map((i) => i.value * scale));
    const min = Math.min(...row.map((i) => i.value * scale));
    return Math.max((len * len * max) / (sum * sum), (sum * sum) / (len * len * min));
  };

  while (rest.length > 0) {
    const vertical = cw >= ch;
    const len = vertical ? ch : cw;
    const row: TreeItem[] = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], len) <= worst(row, len)) {
      row.push(rest[i]);
      i++;
    }
    const rowSum = row.reduce((a, r) => a + r.value * scale, 0);
    const thick = rowSum / len;
    let off = 0;
    for (const it of row) {
      const size = (it.value * scale) / thick;
      out.push(
        vertical
          ? { ...it, x: cx, y: cy + off, w: thick, h: size }
          : { ...it, x: cx + off, y: cy, w: size, h: thick },
      );
      off += size;
    }
    if (vertical) {
      cx += thick;
      cw -= thick;
    } else {
      cy += thick;
      ch -= thick;
    }
    rest = rest.slice(row.length);
    if (rest.length === 0 || cw <= 0.5 || ch <= 0.5) break;
    const remaining = rest.reduce((a, r) => a + r.value, 0);
    if (remaining > 0) scale = (cw * ch) / remaining;
  }
  return out;
}

/**
 * Jede Kachel ist eine Position: Größe = Anteil am Depot, Farbe = Rendite.
 * Zeigt sofort, wo das Geld liegt und ob es dort arbeitet.
 */
export function ReturnTreemap({ items }: { items: TreeItem[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 100;
  const H = 56;

  const sorted = useMemo(
    () => [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value),
    [items],
  );
  const tiles = useMemo(() => squarify(sorted, 0, 0, W, H), [sorted]);
  const scale = useMemo(() => {
    const abs = sorted.map((i) => Math.abs(i.ret ?? 0)).sort((a, b) => b - a);
    return Math.max(0.15, abs[0] ?? 0.5);
  }, [sorted]);

  if (tiles.length === 0) {
    return <div className="py-8 text-center text-sm text-subtle">Keine bewerteten Positionen.</div>;
  }
  const active = hover ? sorted.find((s) => s.key === hover) : null;

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <span className="text-sm font-semibold">
          {active ? active.label : "Größe = Anteil, Farbe = Rendite"}
        </span>
        {active && (
          <span
            className={`text-sm font-semibold tabular-nums ${
              (active.ret ?? 0) >= 0 ? "text-bull" : "text-bear"
            }`}
          >
            {active.ret === null ? "—" : pctStr(active.ret)}
          </span>
        )}
        {active && <span className="text-[11px] text-subtle">{cMoney(active.value)}</span>}
      </div>

      <div
        className="relative w-full overflow-hidden rounded-xl"
        style={{ aspectRatio: `${W} / ${H}` }}
        onMouseLeave={() => setHover(null)}
      >
        {tiles.map((t, i) => {
          const on = hover === t.key;
          const big = t.w > 14 && t.h > 12;
          return (
            <div
              key={t.key}
              className="absolute overflow-hidden p-1.5 transition-[filter,transform] duration-150"
              style={{
                left: `${t.x}%`,
                top: `${(t.y / H) * 100}%`,
                width: `${t.w}%`,
                height: `${(t.h / H) * 100}%`,
                backgroundColor: heatColor((t.ret ?? 0) / scale),
                outline: "2px solid white",
                zIndex: on ? 2 : 1,
                filter: on ? "brightness(0.94)" : undefined,
                animation: `fadeUp 420ms cubic-bezier(0.22,1,0.36,1) ${i * 45}ms both`,
              }}
              onMouseEnter={() => setHover(t.key)}
            >
              {big && (
                <>
                  <div className="truncate text-[11px] font-semibold leading-tight text-slate-900">
                    {t.label}
                  </div>
                  <div className="truncate text-[10px] tabular-nums text-slate-700">
                    {t.ret === null ? cAbbrev(t.value) : pctStr(t.ret)}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Beitrag zum Gewinn ──────────────────────────────────────────────────────

/**
 * Welche Position hat wie viel Euro zum Gesamtgewinn beigetragen? Prozente
 * täuschen: 300 % auf eine Kleinstposition bringen weniger als 20 % auf die
 * größte.
 */
export function ContributionBars({
  items,
}: {
  items: { key: string; label: string; gain: number }[];
}) {
  const sorted = useMemo(
    () => [...items].filter((i) => Math.abs(i.gain) > 0.01).sort((a, b) => b.gain - a.gain),
    [items],
  );
  if (sorted.length === 0) return null;
  const max = Math.max(...sorted.map((i) => Math.abs(i.gain)));
  const totalPos = sorted.filter((i) => i.gain > 0).reduce((a, i) => a + i.gain, 0);

  return (
    <div>
      <div className="mb-3 text-[11px] text-subtle">
        In Euro, nicht in Prozent. {sorted[0] && totalPos > 0 && (
          <>
            <span className="font-semibold text-ink">{sorted[0].label}</span> allein steuert{" "}
            {((sorted[0].gain / totalPos) * 100).toFixed(0)} % aller Gewinne bei.
          </>
        )}
      </div>
      <div className="space-y-2">
        {sorted.slice(0, 12).map((i, idx) => {
          const w = (Math.abs(i.gain) / max) * 100;
          const up = i.gain >= 0;
          return (
            <div key={i.key} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 truncate text-xs">{i.label}</span>
              <div className="relative flex h-5 flex-1 items-center">
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200" />
                <div
                  className={`absolute h-3 rounded ${up ? "bg-emerald-400" : "bg-rose-400"}`}
                  style={{
                    left: up ? "50%" : `${50 - w / 2}%`,
                    width: `${w / 2}%`,
                    animation: `growX 600ms cubic-bezier(0.22,1,0.36,1) ${idx * 50}ms both`,
                    transformOrigin: up ? "left" : "right",
                  }}
                />
              </div>
              <span
                className={`w-24 shrink-0 text-right text-xs font-semibold tabular-nums ${
                  up ? "text-bull" : "text-bear"
                }`}
              >
                {up ? "+" : "−"}
                {cAbbrev(Math.abs(i.gain))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Kapitalfluss ────────────────────────────────────────────────────────────

/** Ein- und Auszahlungen je Monat — parqets „Kapitalfluss“. */
export function CapitalFlow({
  flows,
}: {
  flows: { month: string; in: number; out: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = flows.slice(-36);
  if (shown.length === 0) return null;

  const max = Math.max(...shown.map((f) => Math.max(f.in, f.out)), 1);
  const totalIn = flows.reduce((a, f) => a + f.in, 0);
  const totalOut = flows.reduce((a, f) => a + f.out, 0);
  const h = hover !== null ? shown[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <div className="text-lg font-semibold tabular-nums text-bull">{cMoney(totalIn)}</div>
          <div className="text-[11px] text-subtle">eingezahlt</div>
        </div>
        <div>
          <div className="text-lg font-semibold tabular-nums text-bear">{cMoney(totalOut)}</div>
          <div className="text-[11px] text-subtle">entnommen</div>
        </div>
        <div>
          <div className="text-lg font-semibold tabular-nums">{cMoney(totalIn - totalOut)}</div>
          <div className="text-[11px] text-subtle">netto eingesetzt</div>
        </div>
        {h && (
          <div className="ml-auto text-right">
            <div className="text-sm font-semibold tabular-nums">
              <span className="text-bull">+{cAbbrev(h.in)}</span>
              {h.out > 0 && <span className="text-bear"> −{cAbbrev(h.out)}</span>}
            </div>
            <div className="text-[11px] text-subtle">
              {MONTHS[Number(h.month.slice(5, 7)) - 1]} {h.month.slice(0, 4)}
            </div>
          </div>
        )}
      </div>

      <div className="flex h-32 items-center gap-[3px]" onMouseLeave={() => setHover(null)}>
        {shown.map((f, i) => (
          <div
            key={f.month}
            className="flex h-full flex-1 cursor-default flex-col justify-center"
            onMouseEnter={() => setHover(i)}
            style={{ opacity: hover === null || hover === i ? 1 : 0.4 }}
          >
            <div className="flex h-1/2 flex-col justify-end">
              <div
                className="w-full rounded-t bg-emerald-400"
                style={{
                  height: `${(f.in / max) * 100}%`,
                  transition: `height 600ms cubic-bezier(0.22,1,0.36,1) ${i * 10}ms`,
                }}
              />
            </div>
            <div className="h-px bg-slate-200" />
            <div className="h-1/2">
              <div
                className="w-full rounded-b bg-rose-400"
                style={{
                  height: `${(f.out / max) * 100}%`,
                  transition: `height 600ms cubic-bezier(0.22,1,0.36,1) ${i * 10}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-subtle">
        <span>
          {shown[0] && `${MONTHS[Number(shown[0].month.slice(5, 7)) - 1]} ${shown[0].month.slice(2, 4)}`}
        </span>
        <span>
          {shown.length > 1 &&
            `${MONTHS[Number(shown[shown.length - 1].month.slice(5, 7)) - 1]} ${shown[
              shown.length - 1
            ].month.slice(2, 4)}`}
        </span>
      </div>
    </div>
  );
}
