"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ActivityBars } from "@/components/ActivityBars";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ErrorRetry } from "@/components/ErrorRetry";
import { Icon } from "@/components/Icon";
import { StatRow, DetailTopBar } from "@/components/ui";
import { SkeletonPage } from "@/components/Skeleton";
import { TradeFeed } from "@/components/TradeFeed";
import { fetchJson } from "@/lib/fetchJson";
import { fixTicker } from "@/lib/format";
import type { InsiderDetail, InsiderResponse } from "@/lib/types";

export default function InsiderPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const [ins, setIns] = useState<InsiderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLoading(true);
    setErr(false);
    fetchJson<InsiderResponse>(`/api/insider?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((d) => setIns(d.insider))
      .catch(() => { if (!controller.signal.aborted) setErr(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, tick]);

  if (loading) return <SkeletonPage />;
  if (err) return <ErrorRetry onRetry={() => setTick((t) => t + 1)} />;
  if (!ins)
    return (
      <div className="py-16 text-center text-[15px] text-subtle">
        Insider nicht gefunden.{" "}
        <Link href="/feed?type=corporate_insider" className="text-ink underline">Zu den Insider-Meldungen</Link>
      </div>
    );

  const buys = ins.trades.filter((t) => t.txnType === "buy" && t.transactionCode === "P" && !t.isDerivative).length;
  const sells = ins.trades.filter((t) => t.txnType === "sell" && t.transactionCode === "S" && !t.isDerivative).length;
  const company = ins.company ?? fixTicker(ins.ticker, ins.company) ?? "Unternehmen";
  const stats = [
    { label: "Meldungen", value: ins.trades.length.toLocaleString("de-DE"), cls: "" },
    { label: "Käufe (Code P)", value: String(buys), cls: "text-bull" },
    { label: "Verkäufe (Code S)", value: String(sells), cls: "text-bear" },
  ];

  return (
    <div className="space-y-8">
      <div className="aura-header space-y-5" style={{ ["--aura" as string]: "var(--aura-insider)" }}>
        <DetailTopBar back="/feed?type=corporate_insider" label="Insider" />

        <div className="fade-up flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {/* An executive's picture is the company they report for. */}
          <div className="relative shrink-0">
            {ins.ticker ? (
              <CompanyLogo ticker={ins.ticker} company={company} size={96} rounded="rounded-[26px]" />
            ) : (
              <Avatar name={ins.name} kind="insider" size={96} />
            )}
            {ins.ticker && (
              <div className="absolute -bottom-2 -right-2 rounded-full shadow-[0_4px_14px_rgb(0_0_0/0.18)]">
                <Avatar name={ins.name} kind="insider" size={44} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="large-title">{ins.name}</h1>
            <div className="mt-1 text-[15px] text-subtle">{ins.role || "Insider"}{ins.ticker ? ` · ${company}` : ""}</div>
          </div>
          {ins.ticker && (
            <Link href={`/stock/${encodeURIComponent(ins.ticker)}`} className="btn-capsule">
              <CompanyLogo ticker={ins.ticker} company={company} size={22} rounded="rounded-[7px]" />
              Aktie ansehen
            </Link>
          )}
        </div>

        <div className="fade-up"><StatRow items={stats} /></div>
      </div>

      {ins.trades.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">Handelsaktivität</h2>
          <div className="card p-4 sm:p-5">
            <ActivityBars rows={ins.trades} />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">Alle Meldungen</h2>
        <TradeFeed rows={ins.trades} showActor={false} empty="Noch keine gemeldeten Trades." />
      </section>

      <p className="text-[13px] leading-relaxed text-subtle">Quelle: SEC Form 4. Nur Code P (Kauf am offenen Markt) und S (Verkauf) gelten als Kauf oder Verkauf; Zuteilungen, Steuereinbehalte und Optionsausübungen werden gesondert ausgewiesen.</p>
    </div>
  );
}
