"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { companyName, fixTicker, pct, signalLabel } from "@/lib/format";
import { FeedRow, PriceBar, PricesResponse } from "@/lib/types";

import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";
import { Sparkline } from "./Sparkline";

function price(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `$${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TradeDetailModal({ row, onClose }: { row: FeedRow; onClose: () => void }) {
  const [bars, setBars] = useState<PriceBar[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!row.ticker) {
      setBars([]);
      return;
    }
    let on = true;
    fetch(`/api/prices?ticker=${encodeURIComponent(row.ticker)}`)
      .then((r) => r.json() as Promise<PricesResponse>)
      .then((d) => on && setBars(d.bars))
      .catch(() => on && setBars([]));
    return () => {
      on = false;
    };
  }, [row.ticker]);

  const sig = signalLabel(row.txnType, row.putCall);
  const badge =
    sig.tone === "bull"
      ? "bg-emerald-50 text-emerald-700"
      : sig.tone === "bear"
      ? "bg-rose-50 text-rose-700"
      : "bg-slate-100 text-slate-600";
  const company = companyName(row.ticker, row.securityName);
  const perf = row.pctSinceDisclosure;
  const up = perf === null ? true : perf >= 0;

  // entry = first close on/after disclosure; current = last close
  let entry: number | null = null;
  let current: number | null = null;
  if (bars && bars.length) {
    current = bars[bars.length - 1].close;
    const mark = bars.find((b) => (row.disclosedAt ? b.date >= row.disclosedAt : false));
    entry = mark ? mark.close : bars[0].close;
  }

  const canInvestor = row.entitySlug && row.entityType === "institution";
  const canPolitician = row.entitySlug && row.entityType === "politician";
  const canInsider = row.entitySlug && row.entityType === "corporate_insider";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <CompanyLogo ticker={row.ticker} company={company} size={44} />
              <div className="absolute -bottom-1.5 -right-1.5 rounded-full ring-2 ring-white">
                <Avatar name={row.entityName} size={24} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">{company}</div>
              <div className="truncate text-xs text-subtle">{row.entityName}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-sm text-subtle hover:bg-slate-200"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 pb-2">
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${badge}`}>
            {sig.text}
          </span>
          <span className="font-mono text-xs text-subtle">{fixTicker(row.ticker, company) ?? "—"}</span>
          <span className="ml-auto text-sm font-semibold" style={{ color: up ? "#16a34a" : "#dc2626" }}>
            {pct(perf)}
          </span>
        </div>

        <div className="px-2">
          <Sparkline bars={bars ?? []} markDate={row.disclosedAt} up={up} />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-sm">
          <Stat label="Größe" value={row.sizeDisplay} />
          <Stat label="Handelsdatum" value={row.txnDate ?? "—"} />
          <Stat label="Kurs bei Offenlegung" value={price(entry)} />
          <Stat label="Offengelegt am" value={row.disclosedAt ?? "—"} />
          <Stat label="Aktueller Kurs" value={price(current)} />
          <Stat label="Seit Offenlegung" value={pct(perf)} valueClass={up ? "text-bull" : "text-bear"} />
        </dl>

        <div className="flex gap-2 border-t border-hair p-4">
          {canInvestor && (
            <Link
              href={`/investor/${row.entitySlug}`}
              className="flex-1 rounded-full bg-slate-100 px-3 py-2 text-center text-sm font-medium hover:bg-slate-200"
            >
              Investor ansehen
            </Link>
          )}
          {canPolitician && (
            <Link
              href={`/politician/${row.entitySlug}`}
              className="flex-1 rounded-full bg-slate-100 px-3 py-2 text-center text-sm font-medium hover:bg-slate-200"
            >
              Politiker ansehen
            </Link>
          )}
          {canInsider && (
            <Link
              href={`/insider/${row.entitySlug}`}
              className="flex-1 rounded-full bg-slate-100 px-3 py-2 text-center text-sm font-medium hover:bg-slate-200"
            >
              Insider ansehen
            </Link>
          )}
          {row.ticker && (
            <Link
              href={`/stock/${row.ticker}`}
              className="flex-1 rounded-full bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-slate-800"
            >
              Aktie ansehen
            </Link>
          )}
          <a
            href={row.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full px-3 py-2 text-center text-sm font-medium text-subtle underline hover:text-brand"
          >
            Beleg
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={`font-medium ${valueClass}`}>{value}</dd>
    </div>
  );
}
