"use client";

import { useMemo, useState } from "react";

import { Donut } from "@/components/Donut";
import { cAbbrev, cMoney } from "@/lib/money";

export interface DivEntry {
  month: string; // YYYY-MM
  ticker: string;
  name: string;
  amount: number;
}

const COLORS = [
  "#4f46e5", "#0ea5e9", "#16a34a", "#f59e0b", "#db2777",
  "#8b5cf6", "#14b8a6", "#ef4444", "#65a30d", "#0891b2",
  "#a16207", "#be123c",
];

const MONTH_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/**
 * Gestapeltes Monatsdiagramm der Ausschüttungen — jede Farbe ist ein Papier.
 * Beim Überfahren eines Monats klappt die Zusammensetzung auf; über die Legende
 * lässt sich ein einzelnes Papier isolieren.
 */
export function DividendChart({ entries }: { entries: DivEntry[] }) {
  const [hoverMonth, setHoverMonth] = useState<string | null>(null);
  const [focusTicker, setFocusTicker] = useState<string | null>(null);
  const [year, setYear] = useState<string>("alle");

  const years = useMemo(
    () => [...new Set(entries.map((e) => e.month.slice(0, 4)))].sort().reverse(),
    [entries],
  );

  const filtered = useMemo(
    () => (year === "alle" ? entries : entries.filter((e) => e.month.startsWith(year))),
    [entries, year],
  );

  /** Farbe je Papier, stabil sortiert nach Gesamtsumme. */
  const { colorOf, perTicker } = useMemo(() => {
    const sums = new Map<string, { name: string; amount: number }>();
    for (const e of entries) {
      const cur = sums.get(e.ticker);
      sums.set(e.ticker, { name: e.name, amount: (cur?.amount ?? 0) + e.amount });
    }
    const ranked = [...sums.entries()]
      .map(([ticker, v]) => ({ ticker, ...v }))
      .sort((a, b) => b.amount - a.amount);
    const map = new Map<string, string>();
    ranked.forEach((r, i) => map.set(r.ticker, COLORS[i % COLORS.length]));
    return { colorOf: map, perTicker: ranked };
  }, [entries]);

  /** Monatsraster: lückenlos, damit zahlungsfreie Monate sichtbar bleiben. */
  const months = useMemo(() => {
    if (filtered.length === 0) return [];
    const all = [...new Set(filtered.map((e) => e.month))].sort();
    const out: string[] = [];
    const [y0, m0] = all[0].split("-").map(Number);
    const [y1, m1] = all[all.length - 1].split("-").map(Number);
    for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); ) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return out.slice(-36);
  }, [filtered]);

  const byMonth = useMemo(() => {
    const m = new Map<string, DivEntry[]>();
    for (const e of filtered) {
      if (focusTicker && e.ticker !== focusTicker) continue;
      const list = m.get(e.month) ?? [];
      list.push(e);
      m.set(e.month, list);
    }
    for (const list of m.values()) list.sort((a, b) => b.amount - a.amount);
    return m;
  }, [filtered, focusTicker]);

  const monthTotal = (mo: string) => (byMonth.get(mo) ?? []).reduce((a, e) => a + e.amount, 0);
  const max = Math.max(...months.map(monthTotal), 0.01);
  const sum = filtered
    .filter((e) => !focusTicker || e.ticker === focusTicker)
    .reduce((a, e) => a + e.amount, 0);
  const best = months.reduce((a, m) => (monthTotal(m) > monthTotal(a || m) ? m : a), months[0] ?? "");

  const detail = hoverMonth ? byMonth.get(hoverMonth) ?? [] : [];

  if (entries.length === 0) {
    return (
      <div className="lcard p-8 text-center text-sm text-subtle">
        Noch keine Ausschüttungen erfasst.
      </div>
    );
  }

  return (
    <div className="lcard p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Ausschüttungen je Monat</div>
          <p className="text-[11px] text-subtle">
            Jede Farbe ist ein Wertpapier. Fahr über einen Balken für die Zusammensetzung.
          </p>
        </div>
        <div className="no-scrollbar inline-flex overflow-x-auto rounded-full bg-slate-100 p-0.5 text-xs font-medium">
          {["alle", ...years].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`press-sm shrink-0 rounded-full px-3 py-1 ${
                year === y ? "bg-white text-ink shadow-card" : "text-subtle hover:text-ink"
              }`}
            >
              {y === "alle" ? "Alle Jahre" : y}
            </button>
          ))}
        </div>
      </div>

      {/* Kopfzeile: reagiert auf Auswahl */}
      <div className="mb-3 mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <div className="text-xl font-semibold tabular-nums text-bull">{cMoney(sum)}</div>
          <div className="text-[11px] text-subtle">
            {focusTicker
              ? `nur ${perTicker.find((p) => p.ticker === focusTicker)?.name ?? focusTicker}`
              : year === "alle"
              ? "gesamt erhalten"
              : `erhalten ${year}`}
          </div>
        </div>
        {hoverMonth ? (
          <div>
            <div className="text-lg font-semibold tabular-nums">{cMoney(monthTotal(hoverMonth))}</div>
            <div className="text-[11px] text-subtle">
              {MONTH_SHORT[Number(hoverMonth.slice(5, 7)) - 1]} {hoverMonth.slice(0, 4)}
            </div>
          </div>
        ) : (
          months.length > 0 && (
            <div>
              <div className="text-lg font-semibold tabular-nums">{cMoney(sum / months.length)}</div>
              <div className="text-[11px] text-subtle">Durchschnitt je Monat</div>
            </div>
          )
        )}
        {best && !hoverMonth && (
          <div>
            <div className="text-lg font-semibold tabular-nums">{cMoney(monthTotal(best))}</div>
            <div className="text-[11px] text-subtle">
              bester Monat · {MONTH_SHORT[Number(best.slice(5, 7)) - 1]} {best.slice(0, 4)}
            </div>
          </div>
        )}
      </div>

      {/* Gestapelte Balken */}
      <div className="flex h-44 items-end gap-[3px]" onMouseLeave={() => setHoverMonth(null)}>
        {months.map((mo, mi) => {
          const parts = byMonth.get(mo) ?? [];
          const t = monthTotal(mo);
          const active = hoverMonth === mo;
          return (
            <div
              key={mo}
              className="group flex h-full flex-1 cursor-pointer flex-col justify-end"
              onMouseEnter={() => setHoverMonth(mo)}
            >
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-t"
                style={{
                  height: `${Math.max(t > 0 ? 3 : 1, (t / max) * 100)}%`,
                  opacity: hoverMonth === null || active ? 1 : 0.4,
                  transition: `height 700ms cubic-bezier(0.22,1,0.36,1) ${mi * 12}ms, opacity 150ms`,
                }}
              >
                {parts.length === 0 ? (
                  <div className="h-full w-full bg-slate-200" />
                ) : (
                  parts.map((p, i) => (
                    <div
                      key={p.ticker + i}
                      style={{
                        height: `${(p.amount / t) * 100}%`,
                        backgroundColor: colorOf.get(p.ticker) ?? "#cbd5e1",
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-subtle">
        <span>
          {months[0] &&
            `${MONTH_SHORT[Number(months[0].slice(5, 7)) - 1]} ${months[0].slice(2, 4)}`}
        </span>
        <span>
          {months.length > 1 &&
            `${MONTH_SHORT[Number(months[months.length - 1].slice(5, 7)) - 1]} ${months[
              months.length - 1
            ].slice(2, 4)}`}
        </span>
      </div>

      {/* Zusammensetzung des überfahrenen Monats */}
      {detail.length > 0 && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <div className="mb-2 text-[11px] font-semibold text-subtle">
            {MONTH_SHORT[Number(hoverMonth!.slice(5, 7)) - 1]} {hoverMonth!.slice(0, 4)} —{" "}
            {detail.length} {detail.length === 1 ? "Zahlung" : "Zahlungen"}
          </div>
          <div className="space-y-1">
            {detail.slice(0, 6).map((d, i) => (
              <div key={d.ticker + i} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorOf.get(d.ticker) ?? "#cbd5e1" }}
                />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <span className="font-semibold tabular-nums">{cMoney(d.amount)}</span>
              </div>
            ))}
            {detail.length > 6 && (
              <div className="text-[11px] text-subtle">+{detail.length - 6} weitere</div>
            )}
          </div>
        </div>
      )}

      {/* Legende: klickbar zum Isolieren */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {perTicker.slice(0, 14).map((p) => {
          const on = focusTicker === p.ticker;
          return (
            <button
              key={p.ticker}
              onClick={() => setFocusTicker(on ? null : p.ticker)}
              className={`press-sm flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                on ? "bg-slate-900 text-white" : "bg-slate-100 text-subtle hover:text-ink"
              }`}
              title={`${p.name}: ${cMoney(p.amount)}`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: colorOf.get(p.ticker) ?? "#cbd5e1" }}
              />
              <span className="max-w-[9rem] truncate">{p.name}</span>
              <span className="tabular-nums opacity-70">{cAbbrev(p.amount)}</span>
            </button>
          );
        })}
        {focusTicker && (
          <button
            onClick={() => setFocusTicker(null)}
            className="press-sm rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-subtle hover:text-ink"
          >
            Auswahl aufheben
          </button>
        )}
      </div>
    </div>
  );
}

/** Woraus sich die Ausschüttungen zusammensetzen — als Ring. */
export function DividendSplit({ entries }: { entries: DivEntry[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const segs = useMemo(() => {
    const m = new Map<string, { name: string; amount: number }>();
    for (const e of entries) {
      const cur = m.get(e.ticker);
      m.set(e.ticker, { name: e.name, amount: (cur?.amount ?? 0) + e.amount });
    }
    return [...m.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((v, i) => ({ label: v.name, value: v.amount, color: COLORS[i % COLORS.length] }));
  }, [entries]);

  const total = segs.reduce((a, s) => a + s.value, 0);
  if (segs.length === 0) return null;
  const focus = hover !== null && segs[hover] ? segs[hover] : segs[0];

  return (
    <div className="lcard p-5">
      <div className="mb-3 text-sm font-semibold">Woher die Dividenden kommen</div>
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <div className="shrink-0">
          <Donut
            segments={segs}
            size={150}
            countTo={total > 0 ? (focus.value / total) * 100 : 0}
            countFormat={(v) => `${v.toFixed(0)} %`}
            centerBottom={focus.label.length > 15 ? focus.label.slice(0, 14) + "…" : focus.label}
            activeIndex={hover}
            onHover={setHover}
          />
          <div className="mt-1 text-center text-xs font-semibold tabular-nums">
            {cMoney(focus.value)}
          </div>
        </div>
        <div className="w-full flex-1 space-y-1.5">
          {segs.map((s, i) => (
            <div
              key={s.label + i}
              className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-xs transition-colors hover:bg-slate-50"
              style={{ opacity: hover !== null && hover !== i ? 0.45 : 1 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="tabular-nums text-subtle">{cMoney(s.value)}</span>
              <span className="w-12 text-right font-semibold tabular-nums">
                {total > 0 ? ((s.value / total) * 100).toFixed(1) : "0"} %
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
