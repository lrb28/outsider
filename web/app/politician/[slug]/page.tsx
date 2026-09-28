"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ActivityBars } from "@/components/ActivityBars";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ErrorRetry } from "@/components/ErrorRetry";
import { FollowButton } from "@/components/FollowButton";
import { Icon } from "@/components/Icon";
import { SkeletonPage } from "@/components/Skeleton";
import { TradeFeed } from "@/components/TradeFeed";
import { politicianLine, StatRow, DetailTopBar } from "@/components/ui";
import { fetchJson } from "@/lib/fetchJson";
import { companyName, formatDate } from "@/lib/format";
import type { PoliticianDetail, PoliticianResponse } from "@/lib/types";

export default function PoliticianPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const [pol, setPol] = useState<PoliticianDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLoading(true);
    setErr(false);
    fetchJson<PoliticianResponse>(`/api/politician?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((d) => setPol(d.politician))
      .catch(() => { if (!controller.signal.aborted) setErr(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, tick]);

  const summary = useMemo(() => {
    if (!pol) return null;
    const buys = pol.trades.filter((t) => t.txnType === "buy");
    const sells = pol.trades.filter((t) => t.txnType === "sell");
    const byTicker = new Map<string, { ticker: string; name: string; n: number; buys: number }>();
    for (const t of pol.trades) {
      if (!t.ticker) continue;
      const cur = byTicker.get(t.ticker) ?? { ticker: t.ticker, name: companyName(t.ticker, t.securityName), n: 0, buys: 0 };
      cur.n++;
      if (t.txnType === "buy") cur.buys++;
      byTicker.set(t.ticker, cur);
    }
    const top = [...byTicker.values()].sort((a, b) => b.n - a.n).slice(0, 6);
    return { buys: buys.length, sells: sells.length, top };
  }, [pol]);

  if (loading) return <SkeletonPage />;
  if (err) return <ErrorRetry onRetry={() => setTick((t) => t + 1)} />;
  if (!pol || !summary)
    return (
      <div className="py-16 text-center text-[15px] text-subtle">
        Politiker nicht gefunden.{" "}
        <Link href="/discover?tab=politicians" className="text-ink underline">Zurück</Link>
      </div>
    );

  const stats = [
    { label: "Gemeldete Trades", value: pol.trades.length.toLocaleString("de-DE") },
    { label: "Käufe / Verkäufe", value: `${summary.buys} / ${summary.sells}` },
    { label: "Letzte Meldung", value: formatDate(pol.trades[0]?.disclosedAt) },
  ];

  return (
    <div className="space-y-8">
      <div className="aura-header space-y-5" style={{ ["--aura" as string]: "var(--aura-politician)", ["--aura-2" as string]: "var(--aura-investor)" }}>
        <DetailTopBar back="/discover?tab=politicians" label="Politiker" action={<FollowButton kind="politician" id={pol.slug} />} />

        <div className="fade-up flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar name={pol.name} src={pol.photo} kind="politician" size={104} className="shadow-[0_10px_30px_rgb(0_0_0/0.16)]" />
          <div className="min-w-0 flex-1">
            <h1 className="large-title">{pol.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[15px] text-subtle">
              <span className="rounded-full bg-politician/10 px-2.5 py-1 text-[13px] font-semibold text-politician">{politicianLine(pol.party, pol.seat)}</span>
              <span>US-Repräsentantenhaus</span>
            </div>
          </div>
        </div>

        <div className="fade-up"><StatRow items={stats} /></div>
      </div>

      {pol.trades.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Handelsaktivität</h2>
          <div className="card p-4 sm:p-5">
            <ActivityBars rows={pol.trades} />
          </div>
        </section>
      )}

      {summary.top.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Meistgehandelt</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {summary.top.map((t) => (
              <Link key={t.ticker} href={`/stock/${encodeURIComponent(t.ticker)}`} className="card lcard-hover press flex items-center gap-3 p-3">
                <CompanyLogo ticker={t.ticker} company={t.name} size={40} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">{t.name}</div>
                  <div className="text-[13px] text-subtle">{t.n} Trades · {t.buys} Käufe</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Alle Meldungen</h2>
        <TradeFeed
          rows={pol.trades}
          showActor={false}
          empty="Noch keine maschinenlesbaren Meldungen. Eingescannte PDFs lassen sich (noch) nicht automatisch auslesen."
        />
      </section>

      <p className="text-[13px] leading-relaxed text-subtle">
        Quelle: Periodic Transaction Reports (STOCK Act) des US-Repräsentantenhauses. Beträge sind Spannen, gemeldet bis zu 45 Tage nach dem Trade. Offizielles Porträt des US-Kongresses (gemeinfrei).
      </p>
    </div>
  );
}
