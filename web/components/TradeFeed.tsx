"use client";

import Link from "next/link";

import { companyName, pct, signalLabel } from "@/lib/format";
import { FeedRow } from "@/lib/types";

import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";

const TYP: Record<string, string> = {
  institution: "Institution",
  corporate_insider: "Insider",
  politician: "Politiker",
};

export function TradeFeed({
  rows,
  showActor = true,
  loading = false,
  empty = "Keine Trades für diese Auswahl.",
}: {
  rows: FeedRow[];
  showActor?: boolean;
  loading?: boolean;
  empty?: string;
}) {
  const grid = showActor
    ? "md:grid-cols-[1.7fr_1.5fr_1fr_1fr_0.8fr]"
    : "md:grid-cols-[2fr_1fr_1fr_0.8fr]";

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div
        className={`hidden ${grid} gap-3 border-b border-hair px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-subtle md:grid`}
      >
        {showActor && <div>Akteur</div>}
        <div>Unternehmen</div>
        <div>Signal</div>
        <div>Größe</div>
        <div className="text-right">Seit Offenlegung</div>
      </div>

      {loading && <div className="px-4 py-10 text-center text-sm text-subtle">Lädt…</div>}
      {!loading && rows.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-subtle">{empty}</div>
      )}

      {!loading &&
        rows.map((r) => {
          const sig = signalLabel(r.txnType, r.putCall);
          const badge =
            sig.tone === "bull"
              ? "bg-emerald-50 text-emerald-700"
              : sig.tone === "bear"
              ? "bg-rose-50 text-rose-700"
              : "bg-slate-100 text-slate-600";
          const perf = r.pctSinceDisclosure;
          const perfCls = perf === null ? "text-subtle" : perf >= 0 ? "text-bull" : "text-bear";
          const canLinkActor = r.entitySlug && r.entityType === "institution";
          const company = companyName(r.ticker, r.securityName);
          return (
            <div
              key={r.id}
              className={`grid grid-cols-1 ${grid} items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50`}
            >
              {showActor && (
                <div className="flex items-center gap-3">
                  <Avatar name={r.entityName} size={36} />
                  <div className="min-w-0">
                    {canLinkActor ? (
                      <Link
                        href={`/investor/${r.entitySlug}`}
                        className="flex items-center gap-1.5 text-sm font-medium hover:text-brand"
                      >
                        <span className="truncate">{r.entityName}</span>
                        {r.highlight && <span className="text-amber-500">★</span>}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">{r.entityName}</span>
                        {r.highlight && <span className="text-amber-500">★</span>}
                      </div>
                    )}
                    <div className="text-xs text-subtle">{TYP[r.entityType]}</div>
                  </div>
                </div>
              )}

              <div className="flex min-w-0 items-center gap-2.5">
                <CompanyLogo ticker={r.ticker} company={company} size={34} />
                <div className="min-w-0">
                  {r.ticker ? (
                    <Link
                      href={`/stock/${r.ticker}`}
                      className="block truncate text-sm font-medium hover:text-brand"
                    >
                      {company}
                    </Link>
                  ) : (
                    <div className="truncate text-sm font-medium">{company}</div>
                  )}
                  <div className="font-mono text-xs text-subtle">{r.ticker ?? "—"}</div>
                </div>
              </div>

              <div>
                <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${badge}`}>
                  {sig.text}
                </span>
              </div>

              <div className="text-sm">
                {r.sizeDisplay}
                <div className="text-xs text-subtle">{r.disclosedAt ?? "—"}</div>
              </div>

              <div className="md:text-right">
                <div className={`text-sm font-semibold ${perfCls}`}>{pct(perf)}</div>
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-subtle underline hover:text-brand"
                >
                  Beleg
                </a>
              </div>
            </div>
          );
        })}
    </div>
  );
}
