"use client";

import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Donut } from "@/components/Donut";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { SegmentedControl } from "@/components/ui";
import { abbrevMoney, auraOf, formatDate, NBSP, num, weightPct } from "@/lib/format";
import type { FeedRow, StockHolder, StockMove, StockMoveKind } from "@/lib/types";

// ── Vocabulary ──────────────────────────────────────────────────────────────
// A diverging ramp: deep emerald for a new stake, light emerald for adding,
// grey for no change, light rose for trimming, deep rose for selling out.
// Lightness carries the order too, so it reads without colour vision.
export const MOVES: Record<StockMoveKind, { label: string; short: string; color: string; tone: "bull" | "bear" | "flat" }> = {
  new: { label: "Neu eingestiegen", short: "Neu eingestiegen", color: "rgb(var(--bull-deep))", tone: "bull" },
  added: { label: "Aufgestockt", short: "Aufgestockt", color: "rgb(var(--bull-hi))", tone: "bull" },
  held: { label: "Unverändert", short: "Unverändert", color: "rgb(var(--flat-fill))", tone: "flat" },
  reduced: { label: "Reduziert", short: "Reduziert", color: "rgb(var(--bear-hi))", tone: "bear" },
  exited: { label: "Komplett verkauft", short: "Ausgestiegen", color: "rgb(var(--bear-deep))", tone: "bear" },
};
const ORDER: StockMoveKind[] = ["new", "added", "held", "reduced", "exited"];
export const INFLOW: StockMoveKind[] = ["new", "added"];
export const OUTFLOW: StockMoveKind[] = ["reduced", "exited"];

const shares = (v: number | null) => (v === null ? "—" : v >= 1e6 ? `${num(v / 1e6)}${NBSP}Mio. St.` : `${Math.round(v).toLocaleString("de-DE")}${NBSP}St.`);
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("de-DE")} ${n === 1 ? one : many}`;

/** "+12,4 %" / "−94,2 %" share change, "Neu", "Verkauft". */
function changeLabel(m: StockMove): string {
  if (m.kind === "new") return "Neu";
  if (m.kind === "exited") return "Verkauft";
  if (m.kind === "held" || !m.prevShares || m.shares === null) return "±0 %";
  const c = (m.shares - m.prevShares) / m.prevShares;
  const pct = Math.abs(c * 100);
  return `${c >= 0 ? "+" : "−"}${num(pct, pct >= 100 ? 0 : 1)}${NBSP}%`;
}

// ── Sheets ──────────────────────────────────────────────────────────────────

function PersonRow({ href, name, sub, kind = "investor", ticker, company, trailing, meta, onNavigate }: {
  href: string | null; name: string; sub: string; kind?: "investor" | "insider" | "politician"; ticker?: string | null; company?: string;
  trailing: React.ReactNode; meta?: React.ReactNode; onNavigate: () => void;
}) {
  const body = (
    <>
      <Avatar name={name} kind={kind} ticker={ticker} company={company} size={42} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold leading-tight">{name}</div>
        <div className="mt-0.5 truncate text-[13px] text-subtle">{sub}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[15px] font-semibold tabular-nums">{trailing}</div>
        {meta && <div className="text-[12px] tabular-nums text-subtle">{meta}</div>}
      </div>
    </>
  );
  const cls = "relative flex min-h-[3.75rem] items-center gap-3 px-5 py-2.5 after:absolute after:bottom-0 after:left-[4.75rem] after:right-0 after:h-px after:bg-hair last:after:hidden";
  return href ? (
    <Link href={href} onClick={onNavigate} className={`${cls} transition-colors hover:bg-ink/[0.03] active:bg-ink/[0.06]`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function HoldersSheet({ holders, company, value, asOf, onClose }: { holders: StockHolder[]; company: string; value: number | null; asOf?: string | null; onClose: () => void }) {
  const funds = new Set(holders.map((h) => h.slug)).size;
  return (
    <Sheet
      title="Investoren mit Bestand"
      subtitle={`${plural(funds, "Fonds hält", "Fonds halten")} ${company}${value ? ` im Wert von ${abbrevMoney(value)}` : ""}${asOf ? ` · 13F zum ${formatDate(asOf)}` : ""}.`}
      onClose={onClose}
    >
      <div className="pb-3">
        {holders.map((h) => (
          <PersonRow
            key={`${h.slug}-${h.putCall ?? "stock"}`}
            href={h.slug ? `/investor/${h.slug}` : null}
            name={h.person ?? h.fund}
            sub={`${h.fund}${h.putCall ? ` · ${h.putCall}-Option` : ""}`}
            trailing={h.putCall ? h.putCall : weightPct(h.weight)}
            meta={abbrevMoney(h.value)}
            onNavigate={onClose}
          />
        ))}
      </div>
    </Sheet>
  );
}

export function MovesSheet({ title, kinds, moves, company, onClose }: { title: string; kinds: StockMoveKind[]; moves: StockMove[]; company: string; onClose: () => void }) {
  const groups = kinds.map((k) => ({ kind: k, rows: moves.filter((m) => m.kind === k) })).filter((g) => g.rows.length);
  const n = groups.reduce((a, g) => a + g.rows.length, 0);
  const asOf = moves.find((m) => m.asOf)?.asOf;
  return (
    <Sheet
      title={title}
      subtitle={`${plural(n, "Investor", "Investoren")} · ${company}, letzter 13F-Bericht${asOf ? ` (${formatDate(asOf)})` : ""} gegenüber dem Vorquartal.`}
      onClose={onClose}
    >
      <div className="pb-3">
        {groups.length === 0 && <p className="px-5 py-8 text-center text-[15px] text-subtle">Keine Bewegung in diesem Quartal.</p>}
        {groups.map((g) => (
          <section key={g.kind}>
            <h3 className="flex items-center gap-2 px-5 pb-1 pt-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-subtle">
              <span aria-hidden="true" className="dot-3d" style={{ ["--c" as string]: MOVES[g.kind].color }} />
              {MOVES[g.kind].label} · {g.rows.length}
            </h3>
            {g.rows.map((m) => (
              <PersonRow
                key={m.slug}
                href={`/investor/${m.slug}`}
                name={m.person ?? m.fund}
                sub={m.fund}
                trailing={<span className={MOVES[m.kind].tone === "bull" ? "text-bull" : MOVES[m.kind].tone === "bear" ? "text-bear" : "text-subtle"}>{changeLabel(m)}</span>}
                meta={m.kind === "exited" ? `vorher ${shares(m.prevShares)}` : shares(m.shares)}
                onNavigate={onClose}
              />
            ))}
          </section>
        ))}
      </div>
    </Sheet>
  );
}

export function TradesSheet({ title, subtitle, rows, onClose }: { title: string; subtitle: string; rows: FeedRow[]; onClose: () => void }) {
  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
      <div className="pb-3">
        {rows.length === 0 && <p className="px-5 py-8 text-center text-[15px] text-subtle">Keine Meldungen.</p>}
        {rows.map((r) => {
          const kind = auraOf(r.entityType);
          const base = kind === "investor" ? "investor" : kind === "politician" ? "politician" : "insider";
          return (
            <PersonRow
              key={r.id}
              href={r.entitySlug ? `/${base}/${r.entitySlug}` : null}
              name={r.entityName}
              sub={`${kind === "investor" ? "Investor" : kind === "politician" ? "Politiker" : "Insider"} · ${formatDate(r.disclosedAt ?? r.txnDate)}`}
              kind={kind}
              ticker={kind === "insider" ? r.ticker : null}
              trailing={<span className={r.txnType === "buy" ? "text-bull" : r.txnType === "sell" ? "text-bear" : ""}>{r.txnType === "buy" ? "Kauf" : r.txnType === "sell" ? "Verkauf" : "Vorgang"}</span>}
              meta={r.sizeDisplay}
              onNavigate={onClose}
            />
          );
        })}
      </div>
    </Sheet>
  );
}

// ── Activity card ───────────────────────────────────────────────────────────

type Legend = { key: string; label: string; value: number; color: string; open?: () => void };

function LegendRows({ items, total, hover, setHover, unit }: { items: Legend[]; total: number; hover: number | null; setHover: (i: number | null) => void; unit: [string, string] }) {
  return (
    <ul className="w-full flex-1 space-y-0.5">
      {items.map((s, i) => {
        const share = total ? s.value / total : 0;
        const off = s.value === 0;
        const dim = hover !== null && hover !== i;
        const inner = (
          <>
            <div className="flex items-center gap-2.5">
              <span className="dot-3d" style={{ ["--c" as string]: s.color }} />
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{s.label}</span>
              <span className="text-[14px] tabular-nums text-subtle" aria-label={plural(s.value, unit[0], unit[1])}>{s.value}</span>
              <span className="w-12 text-right text-[15px] font-semibold tabular-nums">{Math.round(share * 100)}{NBSP}%</span>
              {s.open && <Icon name="chevronRight" className={`h-4 w-4 shrink-0 text-muted ${off ? "invisible" : ""}`} />}
            </div>
            <div className="ml-5 mt-1.5 h-1 overflow-hidden rounded-full bg-surface2">
              <div className="h-full origin-left rounded-full animate-[growX_0.9s_cubic-bezier(0.32,0.72,0,1)_both]" style={{ width: `${share * 100}%`, background: s.color, animationDelay: `${120 + i * 70}ms` }} />
            </div>
          </>
        );
        const cls = `block w-full rounded-xl px-2 py-2 text-left transition-[background-color,opacity] duration-200 ${dim ? "opacity-45" : ""} ${off ? "opacity-45" : ""}`;
        return (
          <li key={s.key} onMouseEnter={() => !off && setHover(i)} onMouseLeave={() => setHover(null)}>
            {s.open && !off ? (
              <button type="button" onClick={s.open} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className={`${cls} !min-h-0 hover:bg-ink/[0.03] active:bg-ink/[0.06]`}>{inner}</button>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function StockActivity({ company, moves, trades, onOpenMoves, onOpenTrades }: {
  company: string;
  moves: StockMove[] | null;
  trades: FeedRow[];
  onOpenMoves: (kinds: StockMoveKind[], title: string) => void;
  onOpenTrades: (rows: FeedRow[], title: string, subtitle: string) => void;
}) {
  const [tab, setTab] = useState<"inv" | "ins">("inv");
  const [hover, setHover] = useState<number | null>(null);

  // Investors: the latest 13F against the quarter before (all tracked funds).
  const inv: Legend[] = moves
    ? ORDER.map((k) => ({ key: k, label: MOVES[k].short, value: moves.filter((m) => m.kind === k).length, color: MOVES[k].color, open: () => onOpenMoves([k], MOVES[k].label) }))
    : [];
  // Insiders: latest confirmed buy (P) or sell (S) per person in the loaded filings.
  const insiderTrades = trades.filter((t) => t.entityType === "corporate_insider" && !t.isDerivative && ["P", "S"].includes(t.transactionCode ?? ""));
  const latest = new Map<string, FeedRow>();
  for (const t of insiderTrades) if (!latest.has(t.entityName)) latest.set(t.entityName, t);
  const insBuys = [...latest.values()].filter((t) => t.transactionCode === "P");
  const insSells = [...latest.values()].filter((t) => t.transactionCode === "S");
  const ins: Legend[] = [
    { key: "buy", label: "Gekauft", value: insBuys.length, color: "rgb(var(--bull-fill))", open: () => onOpenTrades(insBuys, "Insider-Käufe", `Jüngster Kauf je Insider bei ${company}.`) },
    { key: "sell", label: "Verkauft", value: insSells.length, color: "rgb(var(--bear-fill))", open: () => onOpenTrades(insSells, "Insider-Verkäufe", `Jüngster Verkauf je Insider bei ${company}.`) },
  ];

  const invTotal = inv.reduce((a, s) => a + s.value, 0);
  const insTotal = ins.reduce((a, s) => a + s.value, 0);
  if (invTotal === 0 && insTotal === 0) return null;
  const cur = tab === "inv" ? inv : ins;
  const total = tab === "inv" ? invTotal : insTotal;
  const unit: [string, string] = tab === "inv" ? ["Investor", "Investoren"] : ["Insider", "Insider"];
  const active = hover !== null ? cur[hover] : null;
  const asOf = moves?.find((m) => m.asOf)?.asOf;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[14rem] flex-1">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Aktivität</h2>
          <p className="text-[13px] leading-snug text-subtle">
            {tab === "inv"
              ? `Letzter 13F-Bericht je Investor${asOf ? ` (${formatDate(asOf)})` : ""} gegenüber dem Vorquartal. Ohne Optionen.`
              : "Jüngster bestätigter Kauf oder Verkauf je Insider (Form 4, Code P/S)."}
          </p>
        </div>
        <SegmentedControl label="Aktivität von" size="sm" options={[["inv", "Investoren"], ["ins", "Insider"]] as const} value={tab} onChange={(v) => { setHover(null); setTab(v); }} />
      </div>

      {total === 0 ? (
        <div className="card p-6 text-center text-[15px] text-subtle">
          {tab === "inv" ? "Keine Investoren-Bewegung im letzten Quartal." : "Keine Insider-Käufe oder -Verkäufe in den geladenen Meldungen."}
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-5 p-5 sm:flex-row sm:gap-8">
          <Donut
            segments={cur.map((s) => ({ label: s.label, value: s.value, color: s.color }))}
            size={172}
            thickness={20}
            centerTop={String(active ? active.value : total)}
            centerBottom={active ? active.label : unit[total === 1 ? 0 : 1]}
            activeIndex={hover}
            onHover={setHover}
            label={cur.map((s) => `${s.label}: ${s.value}`).join(", ")}
          />
          <LegendRows items={cur} total={total} hover={hover} setHover={setHover} unit={unit} />
        </div>
      )}
    </section>
  );
}
