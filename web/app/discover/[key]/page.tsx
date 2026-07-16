"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/CompanyLogo";
import { fixTicker } from "@/lib/format";
import { CollectionItem, DiscoverData } from "@/lib/types";

const META: Record<
  string,
  { title: string; blurb: string; pick: (d: DiscoverData) => CollectionItem[] }
> = {
  conviction: {
    title: "Höchste Überzeugung",
    blurb:
      "Aktien, in die ein einzelner Investor den größten Anteil seines Portfolios steckt. Keine Diversifikation — ein Statement.",
    pick: (d) => d.highestConviction,
  },
  mostheld: {
    title: "Am meisten gehalten",
    blurb: "Die Aktien, die die meisten der verfolgten Investoren gemeinsam im Depot haben.",
    pick: (d) => d.mostHeld,
  },
  biggest: {
    title: "Größte Einzelpositionen",
    blurb: "Die wertmäßig größten Einzelwetten unter den verfolgten Investoren.",
    pick: (d) => d.biggest,
  },
};

export default function CollectionPage() {
  const params = useParams<{ key: string }>();
  const key = (params?.key as string) || "";
  const meta = META[key];
  const [items, setItems] = useState<CollectionItem[] | null>(null);

  useEffect(() => {
    fetch("/api/discover")
      .then((r) => r.json() as Promise<DiscoverData>)
      .then((d) => setItems(meta ? meta.pick(d) : []))
      .catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!meta)
    return (
      <div className="py-16 text-center text-sm text-subtle">
        Sammlung nicht gefunden.{" "}
        <Link href="/discover" className="text-brand underline">
          Zu Discover
        </Link>
      </div>
    );

  return (
    <div className="space-y-6">
      <Link href="/discover" className="inline-block text-sm text-subtle hover:text-ink">
        ‹ Discover
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-subtle">{meta.blurb}</p>
      </div>

      {items === null && <div className="py-10 text-center text-sm text-subtle">Lädt…</div>}

      {items && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {items.map((it, i) => {
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
          {items.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">Noch keine Daten.</div>
          )}
        </div>
      )}
    </div>
  );
}
