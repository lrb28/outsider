"use client";

import { useState } from "react";

import {
  companyName,
  disclosureLabel,
  fixTicker,
  formatDate,
  groupSeries,
  SERIES_MIN,
  tradeSignal,
  isStaleDate,
} from "@/lib/format";
import { FeedRow } from "@/lib/types";

import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";
import { Icon } from "./Icon";
import { SkeletonList } from "./Skeleton";
import { TradeDetailModal } from "./TradeDetailModal";

const TYP: Record<string, string> = {
  institution: "Institution",
  corporate_insider: "Insider",
  politician: "Politiker",
};

export function TradeFeed({
  rows,
  showActor = true,
  loading = false,
  dark = false,
  empty = "Keine Meldungen für diese Auswahl.",
}: {
  rows: FeedRow[];
  showActor?: boolean;
  loading?: boolean;
  dark?: boolean;
  empty?: string;
}) {
  const [selected, setSelected] = useState<FeedRow | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().slice(0, 10);

  if (loading) return <SkeletonList n={6} />;

  const grid = showActor
    ? "md:grid-cols-[1.7fr_1.5fr_1fr_1fr_0.8fr]"
    : "md:grid-cols-[2fr_1fr_1fr_0.8fr]";

  const container = dark
    ? "bg-slate-900/60 ring-1 ring-white/10"
    : "lcard";
  const headBorder = dark ? "border-white/10 text-slate-400" : "border-hair text-subtle";
  const rowBorder = dark ? "border-white/10 hover:bg-white/5" : "border-black/5 hover:bg-white/70";
  const nameCls = dark ? "text-slate-100" : "";
  const subCls = dark ? "text-slate-400" : "text-subtle";
  const emptyCls = dark ? "text-slate-400" : "text-subtle";

  return (
    <>
      {opened.size > 0 && <button className="mb-2 inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-2" onClick={() => setOpened(new Set())}>Serien wieder zusammenfassen</button>}
      <div className={`overflow-hidden rounded-3xl ${container}`}>
        <div
          className={`hidden ${grid} gap-3 border-b px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide md:grid ${headBorder}`}
        >
          {showActor && <div>Akteur</div>}
          <div>Unternehmen</div>
          <div>Vorgang</div>
          <div>Größe · Offenlegung</div>
          <div className="text-right">Seit Offenlegung</div>
        </div>

        {rows.length === 0 && (
          <div className={`px-4 py-10 text-center text-sm ${emptyCls}`}>{empty}</div>
        )}

        {groupSeries(rows).map((g) => {
          // Serie zusammengefasst, solange sie nicht aufgeklappt ist.
          if (g.rows.length >= SERIES_MIN && !opened.has(g.key)) {
            const first = g.rows[0];
            const company = companyName(first.ticker, first.securityName);
            const sig = tradeSignal(first);
            const verb =
              first.txnType === "buy" ? "kauften" : first.txnType === "sell" ? "verkauften" : "meldeten";
            const who =
              first.entityType === "corporate_insider"
                ? "Insider"
                : first.entityType === "politician"
                ? "Politiker"
                : "Investoren";
            return (
              <button
                key={g.key}
                aria-expanded={false}
                onClick={() => setOpened((s) => new Set(s).add(g.key))}
                className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition last:border-0 ${rowBorder}`}
              >
                <CompanyLogo ticker={first.ticker} company={company} size={34} />
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-medium ${nameCls}`}>
                    {g.rows.length} Meldungen zu {company}
                  </div>
                  <div className={`text-xs ${subCls}`}>
                    {sig.text} · {formatDate(first.disclosedAt)}
                  </div>
                </div>
                <div className={`flex shrink-0 items-center gap-0.5 text-[11px] ${subCls}`}>Einzeln zeigen<Icon name="chevronDown" className="h-3.5 w-3.5" /></div>
              </button>
            );
          }
          return g.rows.map((r) => {
            const sig = tradeSignal(r);
            const badge =
              sig.tone === "bull"
                ? "bg-emerald-50 text-bull"
                : sig.tone === "bear"
                ? "bg-rose-50 text-bear"
                : dark
                ? "bg-white/10 text-slate-300"
                : "bg-zinc-100 text-zinc-700";
            const perf = r.priceAsOf && isStaleDate(r.priceAsOf) ? null : r.pctSinceDisclosure;
            const disc = disclosureLabel(perf, r.disclosedAt, today);
            const perfCls = disc.muted ? subCls : perf! >= 0 ? "text-bull" : "text-bear";
            const company = companyName(r.ticker, r.securityName);
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`grid w-full grid-cols-2 ${grid} items-center gap-3 border-b px-4 py-3 text-left transition last:border-0 ${rowBorder}`}
              >
                {showActor && (
                  <div className="flex items-center gap-3">
                    <Avatar name={r.entityName} size={36} />
                    <div className="min-w-0">
                      <div className={`flex items-center gap-1.5 text-sm font-medium ${nameCls}`}>
                        <span className="truncate">{r.entityName}</span>
                        {r.highlight && <Icon name="star" className="h-3.5 w-3.5 text-amber-500 [&_path]:fill-current" aria-label="Hervorgehoben" />}
                      </div>
                      <div className={`text-xs ${subCls}`}>{TYP[r.entityType]}</div>
                    </div>
                  </div>
                )}

                <div className="flex min-w-0 items-center gap-2.5">
                  <CompanyLogo ticker={r.ticker} company={company} size={34} />
                  <div className="min-w-0">
                    <div className={`truncate text-sm font-medium ${nameCls}`}>{company}</div>
                    <div className={`font-mono text-xs ${subCls}`}>
                      {fixTicker(r.ticker, company) ?? "—"}
                    </div>
                  </div>
                </div>

                <div>
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${badge}`}>
                    {sig.text}
                  </span>
                </div>

                <div className={`text-sm ${nameCls}`}>
                  {r.sizeDisplay}
                  <div className={`text-xs ${subCls}`}>{formatDate(r.disclosedAt)}</div>
                </div>

                <div className="md:text-right">
                  <div
                    className={`${disc.muted ? "text-xs" : "text-sm font-semibold"} ${perfCls}`}
                  >
                    {r.priceAsOf && isStaleDate(r.priceAsOf) ? "Kurs veraltet" : disc.text}
                  </div>
                  <div className={`inline-flex items-center gap-0.5 text-[11px] ${subCls}`}>Details<Icon name="chevronRight" className="h-3 w-3" /></div>
                </div>
              </button>
            );
          });
        })}
      </div>

      {selected && <TradeDetailModal row={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
