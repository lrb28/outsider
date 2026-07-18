"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { SkeletonPage } from "@/components/Skeleton";
import { TradeFeed } from "@/components/TradeFeed";
import { fixTicker } from "@/lib/format";
import { InsiderDetail, InsiderResponse } from "@/lib/types";

export default function InsiderPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const [ins, setIns] = useState<InsiderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/insider?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json() as Promise<InsiderResponse>)
      .then((d) => setIns(d.insider))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <SkeletonPage />;
  if (!ins)
    return (
      <div className="py-16 text-center text-sm text-subtle">
        Insider nicht gefunden.{" "}
        <Link href="/feed" className="text-brand underline">
          Zum Feed
        </Link>
      </div>
    );

  const buys = ins.trades.filter((t) => t.txnType === "buy").length;
  const sells = ins.trades.filter((t) => t.txnType === "sell").length;

  return (
    <div className="space-y-6">
      <Link href="/feed" className="inline-block text-sm text-subtle hover:text-ink">
        ‹ Feed
      </Link>

      <div className="flex items-center gap-4">
        <Avatar name={ins.name} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{ins.name}</h1>
          <div className="text-sm text-subtle">{ins.role || "Insider"}</div>
        </div>
        {ins.ticker && (
          <Link
            href={`/stock/${ins.ticker}`}
            className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200"
          >
            <CompanyLogo ticker={ins.ticker} company={ins.company ?? ins.ticker} size={22} rounded="rounded-md" />
            {ins.company ?? fixTicker(ins.ticker, ins.company)}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="text-lg font-semibold tracking-tight">{ins.trades.length}</div>
          <div className="mt-0.5 text-xs text-subtle">Trades</div>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="text-lg font-semibold tracking-tight text-bull">{buys}</div>
          <div className="mt-0.5 text-xs text-subtle">Käufe</div>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="text-lg font-semibold tracking-tight text-bear">{sells}</div>
          <div className="mt-0.5 text-xs text-subtle">Verkäufe</div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Letzte Trades</h2>
        <TradeFeed rows={ins.trades} showActor={false} empty="Noch keine gemeldeten Trades." />
      </section>
    </div>
  );
}
