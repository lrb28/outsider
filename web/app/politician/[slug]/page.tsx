"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { SkeletonPage } from "@/components/Skeleton";
import { TradeFeed } from "@/components/TradeFeed";
import { PoliticianDetail, PoliticianResponse } from "@/lib/types";

export default function PoliticianPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const [pol, setPol] = useState<PoliticianDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/politician?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json() as Promise<PoliticianResponse>)
      .then((d) => setPol(d.politician))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <SkeletonPage />;
  if (!pol)
    return (
      <div className="py-16 text-center text-sm text-subtle">
        Politiker nicht gefunden.{" "}
        <Link href="/politicians" className="text-brand underline">
          Zurück
        </Link>
      </div>
    );

  const lastTrade = pol.trades[0]?.disclosedAt ?? "—";

  return (
    <div className="space-y-6">
      <Link href="/politicians" className="inline-block text-sm text-subtle hover:text-ink">
        ‹ Politiker
      </Link>

      <div className="flex items-center gap-4">
        <Avatar name={pol.name} size={72} />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{pol.name}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {pol.party && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {pol.party}
              </span>
            )}
            {pol.chamber && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {pol.chamber === "House" ? "Repräsentantenhaus" : pol.chamber === "Senate" ? "Senat" : pol.chamber}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="text-lg font-semibold tracking-tight">{pol.trades.length}</div>
          <div className="mt-0.5 text-xs text-subtle">Gemeldete Trades</div>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="text-lg font-semibold tracking-tight">{lastTrade}</div>
          <div className="mt-0.5 text-xs text-subtle">Letzte Meldung</div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Letzte Trades</h2>
        <TradeFeed rows={pol.trades} showActor={false} empty="Noch keine gemeldeten Trades." />
      </section>
    </div>
  );
}
