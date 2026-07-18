"use client";

import { useState } from "react";

import { companyName, fixTicker, formatDate, pct, signalLabel } from "@/lib/format";
import { FeedRow } from "@/lib/types";

import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";
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
  empty = "Keine Trades für diese Auswahl.",
}: {
  rows: FeedRow[];
  showActor?: boolean;
  loading?: boolean;
  dark?: boolean;
  empty?: string;
}) {
  const [selected, setSelected] = useState<FeedRow | null>(null);

  if (loading) return <SkeletonList n={6} />;

  const grid = showActor
    ? "md:grid-cols-[1.7fr_1.5fr_1fr_1fr_0.8fr]"
    : "md:grid-cols-[2fr_1fr_1fr_0.8fr]";

  const container = dark
    ? "bg-slate-900/60 ring-1 ring-white/10"
    : "bg-card shadow-card";
  const headBorder = dark ? "border-white/10 text-slate-400" : "border-hair text-subtle";
  const rowBorder = dark ? "border-white/10 hover:bg-white/5" : "border-hair hover:bg-slate-50";
  const nameCls = dark ? "text-slate-100" : "";
  const subCls = dark ? "text-slate-400" : "text-subtle";
  const emptyCls = dark ? "text-slate-400" : "text-subtle";

  return (
    <>
      <div className={`overflow-hidden rounded-2xl ${container}`}>
        <div
          className={`hidden ${grid} gap-3 border-b px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide md:grid ${headBorder}`}
        >
          {showActor && <div>Akteur</div>}
          <div>Unternehmen</div>
          <div>Signal</div>
          <div>Größe</div>
          <div className="text-right">Seit Offenlegung</div>
        </div>

        {rows.length === 0 && (
          <div className={`px-4 py-10 text-center text-sm ${emptyCls}`}>{empty}</div>
        )}

        {rows.map((r) => {
            const sig = signalLabel(r.txnType, r.putCall);
            const badge =
              sig.tone === "bull"
                ? "bg-emerald-50 text-emerald-700"
                : sig.tone === "bear"
                ? "bg-rose-50 text-rose-700"
                : dark
                ? "bg-white/10 text-slate-300"
                : "bg-slate-100 text-slate-600";
            const perf = r.pctSinceDisclosure;
            const perfCls = perf === null ? subCls : perf >= 0 ? "text-bull" : "text-bear";
            const company = companyName(r.ticker, r.securityName);
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`grid w-full grid-cols-1 ${grid} items-center gap-3 border-b px-4 py-3 text-left transition last:border-0 ${rowBorder}`}
              >
                {showActor && (
                  <div className="flex items-center gap-3">
                    <Avatar name={r.entityName} size={36} />
                    <div className="min-w-0">
                      <div className={`flex items-center gap-1.5 text-sm font-medium ${nameCls}`}>
                        <span className="truncate">{r.entityName}</span>
                        {r.highlight && <span className="text-amber-500">★</span>}
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
                  <div className={`text-sm font-semibold ${perfCls}`}>{pct(perf)}</div>
                  <div className={`text-[11px] ${subCls}`}>Details ›</div>
                </div>
              </button>
            );
          })}
      </div>

      {selected && <TradeDetailModal row={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
