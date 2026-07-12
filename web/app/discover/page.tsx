"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/CompanyLogo";
import { CollectionItem, DiscoverData } from "@/lib/types";

function Collection({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: CollectionItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-subtle">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((it, i) => {
          const inner = (
            <div className="flex h-full items-center gap-3 rounded-2xl bg-card p-3 shadow-card transition hover:shadow-cardhover">
              <CompanyLogo ticker={it.ticker} company={it.company} size={40} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{it.company}</div>
                <div className="text-xs text-subtle">{it.metric}</div>
              </div>
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
      </div>
    </section>
  );
}

export default function DiscoverPage() {
  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/discover")
      .then((r) => r.json() as Promise<DiscoverData>)
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
        <p className="text-sm text-subtle">
          Worauf das smarte Geld gerade setzt — aus den 13F-Portfolios der verfolgten Investoren.
        </p>
      </div>

      {loading && <div className="py-10 text-center text-sm text-subtle">Lädt…</div>}

      {!loading && data && (
        <>
          <Collection
            title="Am meisten gehalten"
            subtitle="Aktien, die die meisten verfolgten Investoren im Depot haben."
            items={data.mostHeld}
          />
          <Collection
            title="Höchste Überzeugung"
            subtitle="Wo ein Investor den größten Anteil seines Portfolios hineinsteckt."
            items={data.highestConviction}
          />
          <Collection
            title="Größte Einzelpositionen"
            subtitle="Die wertmäßig größten Wetten unter den verfolgten Investoren."
            items={data.biggest}
          />
        </>
      )}
    </div>
  );
}
