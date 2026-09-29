"use client";

import { useState } from "react";

import {
  auraOf,
  companyName,
  disclosureLabel,
  fixTicker,
  formatDate,
  groupSeries,
  investorPerson,
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
  institution: "Investor",
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

  const container = dark ? "bg-slate-900/60" : "card";
  const headBorder = dark ? "border-white/10 text-slate-400" : "border-hair text-subtle";
  const rowBorder = dark ? "border-white/10 hover:bg-white/5" : "border-hair hover:bg-ink/[0.03] active:bg-ink/[0.06]";
  const nameCls = dark ? "text-slate-100" : "";
  const subCls = dark ? "text-slate-400" : "text-subtle";
  const emptyCls = dark ? "text-slate-400" : "text-subtle";

  return (
    <>
      {opened.size > 0 && <button className="mb-2 inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-2" onClick={() => setOpened(new Set())}>Serien wieder zusammenfassen</button>}
      <div className={`overflow-hidden rounded-[22px] ${container}`}>
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
                ? "bg-bull/10 text-bull"
                : sig.tone === "bear"
                ? "bg-bear/10 text-bear"
                : dark
                ? "bg-white/10 text-slate-300"
                : "bg-surface2 text-subtle";
            const perf = r.priceAsOf && isStaleDate(r.priceAsOf) ? null : r.pctSinceDisclosure;
            const disc = disclosureLabel(perf, r.disclosedAt, today);
            const perfCls = disc.muted ? subCls : perf! >= 0 ? "text-bull" : "text-bear";
            const company = companyName(r.ticker, r.securityName);
            const actor = r.entityType === "institution" ? investorPerson(r.entityName) ?? r.entityName : r.entityName;
            const insider = r.entityType === "corporate_insider";
            const toneCls = sig.tone === "bull" ? "text-bull" : sig.tone === "bear" ? "text-bear" : nameCls;
            const perfText = r.priceAsOf && isStaleDate(r.priceAsOf) ? "Kurs veraltet" : disc.text;
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`cv-row block w-full border-b px-4 py-3 text-left transition last:border-0 ${rowBorder}`}
              >
                {/* Phone: one list row — picture, who, what, how much. */}
                <div className="flex items-center gap-3 md:hidden">
                  <div className="relative shrink-0">
                    {!showActor || insider ? (
                      <CompanyLogo ticker={r.ticker} company={company} size={42} rounded="rounded-[12px]" />
                    ) : (
                      <>
                        <Avatar name={actor} src={r.entityPhoto} kind={auraOf(r.entityType)} size={42} />
                        <div className="absolute -bottom-1 -right-1.5 flex">
                          <CompanyLogo ticker={r.ticker} company={company} size={20} rounded="rounded-[7px]" className="logo-lift" />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`flex items-center gap-1 truncate text-[15px] font-semibold leading-tight ${nameCls}`}>
                      <span className="truncate">{showActor ? actor : company}</span>
                      {showActor && r.highlight && <Icon name="star" className="h-3.5 w-3.5 shrink-0 text-warn [&_path]:fill-current" aria-label="Hervorgehoben" />}
                    </div>
                    <div className={`mt-0.5 truncate text-[13px] ${subCls}`}>
                      <span className={`font-medium ${toneCls}`}>{sig.text}</span>
                      {" · "}
                      {showActor ? company : fixTicker(r.ticker, company) ?? "—"}
                    </div>
                    <div className={`mt-0.5 truncate text-[12px] ${subCls}`}>
                      {r.sizeDisplay} · {formatDate(r.disclosedAt)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`${disc.muted ? "max-w-[5.5rem] text-[11px] leading-tight" : "text-[15px] font-semibold tabular-nums"} ${perfCls}`}>
                      {perfText}
                    </div>
                    {!disc.muted && <div className={`text-[11px] ${subCls}`}>seit Meldung</div>}
                  </div>
                </div>

                <div className={`hidden ${grid} items-center gap-3 md:grid`}>
                {showActor && (
                  <div className="flex items-center gap-3">
                    <Avatar name={actor} src={r.entityPhoto} kind={auraOf(r.entityType)} ticker={insider ? r.ticker : null} company={company} size={38} />
                    <div className="min-w-0">
                      <div className={`flex items-center gap-1.5 text-sm font-medium ${nameCls}`}>
                        <span className="truncate">{actor}</span>
                        {r.highlight && <Icon name="star" className="h-3.5 w-3.5 text-warn [&_path]:fill-current" aria-label="Hervorgehoben" />}
                      </div>
                      <div className={`flex items-center gap-1 text-xs ${subCls}`}><i className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(var(--aura-${auraOf(r.entityType)}))` }} />{TYP[r.entityType]}</div>
                    </div>
                  </div>
                )}

                <div className="flex min-w-0 items-center gap-2.5">
                  <CompanyLogo ticker={r.ticker} company={company} size={34} />
                  <div className="min-w-0">
                    <div className={`truncate text-sm font-medium ${nameCls}`}>{company}</div>
                    <div className={`text-xs ${subCls}`}>
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
                    {perfText}
                  </div>
                  <div className={`inline-flex items-center gap-0.5 text-[11px] ${subCls}`}>Details<Icon name="chevronRight" className="h-3 w-3" /></div>
                </div>
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
