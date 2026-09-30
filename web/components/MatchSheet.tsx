"use client";

import Link from "next/link";

import { CompanyLogo } from "@/components/CompanyLogo";
import { Sheet } from "@/components/Sheet";
import { ListCard, ListRow } from "@/components/ui";
import { companyName, stockHref } from "@/lib/format";
import { getTxns, positionsFrom } from "@/lib/portfolio";

/** Tickers as the filings write them: upper case, share classes with a dot. */
export const normTicker = (t: string) => t.trim().toUpperCase().replace(/[-/]/g, ".");

/** The Portfolio's open positions (ticker → name), read on the device. */
export function myHoldings(): Map<string, string> {
  const txns = getTxns();
  const names = new Map(txns.filter((t) => t.name).map((t) => [normTicker(t.ticker), t.name!]));
  return new Map(
    positionsFrom(txns)
      .filter((p) => p.shares > 0)
      .map((p) => [normTicker(p.ticker), names.get(normTicker(p.ticker)) ?? p.ticker]),
  );
}

/** Share of the Portfolio's positions that an investor holds too. */
export const matchPct = (shared: number, total: number) => (total > 0 ? Math.round((Math.min(shared, total) / total) * 100) : 0);

/**
 * "It's a 67% match" (after the reference app Eaves): which of your
 * positions an investor's latest 13F holds as well, each a link to the
 * stock, and the way to the investor's whole portfolio.
 */
export function MatchSheet({ slug, who, shared, total, names, onClose }: { slug: string; who: string; shared: string[]; total: number; names: Map<string, string>; onClose: () => void }) {
  const pct = matchPct(shared.length, total);
  return (
    <Sheet
      title={
        <>
          It’s a <span className="text-[rgb(var(--aura-investor))]">{pct}%</span> match
        </>
      }
      subtitle={`You and ${who} both hold ${shared.length} of your ${total} ${total === 1 ? "position" : "positions"}. Their holdings are from the latest 13F.`}
      onClose={onClose}
      footer={
        <Link href={`/investor/${slug}`} onClick={onClose} className="btn-primary w-full">
          See {who}’s portfolio
        </Link>
      }
    >
      <div className="px-4 pb-4 pt-1">
        <ListCard>
          {shared.map((t) => {
            const company = companyName(t, names.get(normTicker(t)) ?? null);
            return (
              <ListRow
                key={t}
                href={stockHref(t)}
                leading={<CompanyLogo ticker={t} company={company} size={36} />}
                title={company}
                subtitle={t}
                trailing={<span className="text-[13px] text-subtle">In your portfolio</span>}
              />
            );
          })}
        </ListCard>
      </div>
    </Sheet>
  );
}
