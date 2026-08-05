"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { SkeletonList } from "@/components/Skeleton";
import { fixTicker } from "@/lib/format";
import { CollectionInvestor, CollectionItem, DiscoverData } from "@/lib/types";

const STOCK_META: Record<string, { title: string; blurb: string; pick: (d: DiscoverData) => CollectionItem[] }> = {
  boughtq: {
    title: "Meistgekauft (Quartal)",
    blurb: "Aktien, die die verfolgten Investoren zuletzt am häufigsten gekauft haben.",
    pick: (d) => d.mostBoughtQ,
  },
  insiderbuys: {
    title: "Insider kaufen",
    blurb: "Aktien, deren eigene Führungskräfte (Form 4) zuletzt am häufigsten zugekauft haben.",
    pick: (d) => d.insiderBuys,
  },
  mostheld: {
    title: "Am meisten gehalten",
    blurb: "Die Aktien, die die meisten verfolgten Investoren gemeinsam im Depot haben.",
    pick: (d) => d.mostHeld,
  },
  conviction: {
    title: "Höchste Überzeugung",
    blurb: "Aktien, in die ein einzelner Investor den größten Anteil seines Portfolios steckt.",
    pick: (d) => d.highestConviction,
  },
  biggest: {
    title: "Größte Einzelpositionen",
    blurb: "Die wertmäßig größten Einzelwetten unter den verfolgten Investoren.",
    pick: (d) => d.biggest,
  },
};

const INV_META: Record<
  string,
  { title: string; blurb: string; base: string; pick: (d: DiscoverData) => CollectionInvestor[] }
> = {
  biggestfunds: {
    title: "Größte Fonds",
    blurb: "Die verfolgten Investoren mit dem größten gemeldeten Portfolio.",
    base: "/investor",
    pick: (d) => d.biggestFunds,
  },
  concentrated: {
    title: "Am konzentriertesten",
    blurb: "Investoren, die den größten Anteil in eine einzige Aktie stecken.",
    base: "/investor",
    pick: (d) => d.mostConcentrated,
  },
  politicians: {
    title: "Aktivste Politiker",
    blurb: "Kongressmitglieder mit den meisten gemeldeten Aktien-Trades.",
    base: "/politician",
    pick: (d) => d.topPoliticians,
  },
};

export default function CollectionPage() {
  const params = useParams<{ key: string }>();
  const key = (params?.key as string) || "";
  const stockMeta = STOCK_META[key];
  const invMeta = INV_META[key];
  const [data, setData] = useState<DiscoverData | null>(null);

  useEffect(() => {
    fetch("/api/discover")
      .then((r) => r.json() as Promise<DiscoverData>)
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const meta = stockMeta ?? invMeta;
  if (!meta)
    return (
      <div className="py-16 text-center text-sm text-subtle">
        Sammlung nicht gefunden.{" "}
        <Link href="/discover" className="text-brand underline">
          Zu Discover
        </Link>
      </div>
    );

  const stockItems = data && stockMeta ? stockMeta.pick(data) : null;
  const invItems = data && invMeta ? invMeta.pick(data) : null;

  return (
    <div className="space-y-6">
      <Link href="/discover" className="inline-block text-sm text-subtle hover:text-ink">
        ‹ Discover
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-subtle">{meta.blurb}</p>
      </div>

      {!data && <SkeletonList n={6} />}

      {stockItems && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {stockItems.map((it, i) => {
            const inner = (
              <div className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50">
                <div className="w-5 text-sm font-semibold text-subtle">{i + 1}</div>
                <CompanyLogo ticker={it.ticker} company={it.company} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{it.company}</div>
                  <div className="font-mono text-xs text-subtle">{fixTicker(it.ticker, it.company) ?? "—"}</div>
                </div>
                <div className="text-sm font-medium text-slate-700">{it.metric}</div>
              </div>
            );
            return it.ticker ? (
              <Link key={`${it.ticker}-${i}`} href={`/stock/${it.ticker}`}>
                {inner}
              </Link>
            ) : (
              <div key={`${it.company}-${i}`}>{inner}</div>
            );
          })}
          {stockItems.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">Noch keine Daten.</div>
          )}
        </div>
      )}

      {invItems && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {invItems.map((p, i) => (
            <Link
              key={p.slug + i}
              href={`${invMeta?.base ?? "/investor"}/${p.slug}`}
              className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50"
            >
              <div className="w-5 text-sm font-semibold text-subtle">{i + 1}</div>
              <Avatar name={p.person ?? p.fund} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.person ?? p.fund}</div>
                <div className="truncate text-xs text-subtle">{p.fund}</div>
              </div>
              <div className="text-sm font-medium text-slate-700">{p.metric}</div>
            </Link>
          ))}
          {invItems.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">Noch keine Daten.</div>
          )}
        </div>
      )}
    </div>
  );
}
