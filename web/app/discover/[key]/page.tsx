"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { SkeletonList } from "@/components/Skeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { fetchCatalogue } from "@/lib/fetchJson";
import { fixTicker } from "@/lib/format";
import { CollectionInvestor, CollectionItem, DiscoverData } from "@/lib/types";
import { Icon } from "@/components/Icon";

const STOCK_META: Record<string, { title: string; blurb: string; pick: (d: DiscoverData) => CollectionItem[] }> = {
  boughtq: {
    title: "Häufige Aufstockungen",
    blurb: "Bestandserhöhungen im jüngsten verfügbaren Quartalsbericht jedes Investors. Keine exakten Kaufzeitpunkte.",
    pick: (d) => d.mostBoughtQ,
  },
  insiderbuys: {
    title: "Insider kaufen",
    blurb: "Börsenkäufe von Insidern (Form 4, Code P, ohne Derivate) aus allen US-Unternehmen, offengelegt in den letzten 90 Tagen. Sortiert nach Zahl der kaufenden Insider und investiertem Betrag.",
    pick: (d) => d.insiderBuys,
  },
  mostheld: {
    title: "Am meisten gehalten",
    blurb: "Die Aktien, die die meisten verfolgten Investoren gemeinsam im Depot haben.",
    pick: (d) => d.mostHeld,
  },
  conviction: {
    title: "Höchste Gewichtung",
    blurb: "Aktien, in die ein einzelner Investor den größten Anteil seiner gemeldeten Bestände ohne Optionen steckt.",
    pick: (d) => d.highestConviction,
  },
  biggest: {
    title: "Größte Einzelpositionen",
    blurb: "Die wertmäßig größten Aktienpositionen unter den verfolgten Investoren.",
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
    blurb: "Abgeordnete des US-Repräsentantenhauses mit den meisten gemeldeten Aktien-Trades in den letzten zwölf Monaten.",
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

  const [error,setError] = useState(false); const [retry,setRetry] = useState(0);
  useEffect(() => {let on = true;setError(false);fetchCatalogue<DiscoverData>("/api/discover").then(d => {if(on) setData(d);}).catch(() => {if(on) setError(true);});return () => {on=false;};},[retry]);

  const meta = stockMeta ?? invMeta;
  if (!meta)
    return (
      <div className="py-16 text-center text-[15px] text-subtle">
        Sammlung nicht gefunden.{" "}
        <Link href="/discover" className="text-ink underline">
          Zu Entdecken
        </Link>
      </div>
    );

  const stockItems = data && stockMeta ? stockMeta.pick(data) : null;
  const invItems = data && invMeta ? invMeta.pick(data) : null;

  const aura = key === "insiderbuys" ? "insider" : key === "politicians" ? "politician" : "investor";
  const podium = (stockItems ?? []).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="aura-header space-y-4" style={{ ["--aura" as string]: `var(--aura-${aura})` }}>
        <Link href="/discover" className="-ml-1 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-subtle hover:text-ink">
          <Icon name="chevronLeft" className="h-4 w-4" />
          Entdecken
        </Link>
        <div className="fade-up">
          <h1 className="large-title">{meta.title}</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-snug text-subtle">{meta.blurb}</p>
        </div>

        {podium.length === 3 && (
          <div className="fade-up grid grid-cols-3 items-end gap-3 pt-2">
            {[1, 0, 2].map((rank) => {
              const it = podium[rank];
              const tall = rank === 0;
              return (
                <Link key={rank} href={it.ticker ? `/stock/${encodeURIComponent(it.ticker)}` : "#"} className={`card lcard-hover press flex flex-col items-center p-3 text-center ${tall ? "pb-6 pt-5" : "pb-4"}`}>
                  <span className="mb-2 text-[13px] font-bold text-subtle">{rank + 1}</span>
                  <div className="rounded-[18px] shadow-[0_8px_22px_rgb(0_0_0/0.14)]">
                    <CompanyLogo ticker={it.ticker} company={it.company} size={tall ? 68 : 54} rounded="rounded-[18px]" />
                  </div>
                  <div className="mt-2 w-full truncate text-[14px] font-semibold">{it.company}</div>
                  <div className="text-[12px] text-subtle">{it.metric}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {error ? <ErrorRetry onRetry={() => setRetry((r) => r + 1)} /> : !data && <SkeletonList n={6} />}

      {stockItems && (
        <div className="card overflow-hidden">
          {stockItems.map((it, i) => {
            const inner = (
              <div className="relative flex items-center gap-3 px-4 py-3 transition-colors after:absolute after:bottom-0 after:left-[5.5rem] after:right-0 after:h-px after:bg-hair hover:bg-ink/[0.03]">
                <div className="w-6 text-right text-[15px] font-semibold tabular-nums text-subtle">{i + 1}</div>
                <CompanyLogo ticker={it.ticker} company={it.company} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{it.company}</div>
                  <div className="text-[13px] text-subtle">{fixTicker(it.ticker, it.company) ?? "—"}</div>
                </div>
                <div className="text-right text-[14px] font-semibold tabular-nums">{it.metric}</div>
              </div>
            );
            return it.ticker ? (
              <Link key={`${it.ticker}-${i}`} href={`/stock/${encodeURIComponent(it.ticker)}`} className="block last:[&>div]:after:hidden">
                {inner}
              </Link>
            ) : (
              <div key={`${it.company}-${i}`}>{inner}</div>
            );
          })}
          {stockItems.length === 0 && <div className="px-4 py-10 text-center text-[15px] text-subtle">Noch keine Daten.</div>}
        </div>
      )}

      {invItems && (
        <div className="card overflow-hidden">
          {invItems.map((p, i) => (
            <Link
              key={p.slug + i}
              href={`${invMeta?.base ?? "/investor"}/${p.slug}`}
              className="relative flex items-center gap-3 px-4 py-3 transition-colors after:absolute after:bottom-0 after:left-[5.5rem] after:right-0 after:h-px after:bg-hair last:after:hidden hover:bg-ink/[0.03]"
            >
              <div className="w-6 text-right text-[15px] font-semibold tabular-nums text-subtle">{i + 1}</div>
              <Avatar name={p.person ?? p.fund} src={p.photo} kind={key === "politicians" ? "politician" : "investor"} size={42} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{p.person ?? p.fund}</div>
                <div className="truncate text-[13px] text-subtle">{p.fund}</div>
              </div>
              <div className="text-right text-[14px] font-semibold tabular-nums">{p.metric}</div>
            </Link>
          ))}
          {invItems.length === 0 && <div className="px-4 py-10 text-center text-[15px] text-subtle">Noch keine Daten.</div>}
        </div>
      )}
    </div>
  );
}
