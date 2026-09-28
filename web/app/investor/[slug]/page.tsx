"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AllocationBar } from "@/components/AllocationBar";
import { Avatar } from "@/components/Avatar";
import { DepotSkyline } from "@/components/DepotSkyline";
import { SegmentedControl, StatRow, DetailTopBar } from "@/components/ui";
import { ErrorRetry } from "@/components/ErrorRetry";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Donut } from "@/components/Donut";
import { FollowButton } from "@/components/FollowButton";
import { SkeletonPage } from "@/components/Skeleton";
import { TradeFeed } from "@/components/TradeFeed";
import { fetchJson } from "@/lib/fetchJson";
import { abbrevMoney, companyName, fixTicker, formatDate, weightPct } from "@/lib/format";
import { InvestorDetail, InvestorResponse } from "@/lib/types";
import { Icon } from "@/components/Icon";

export default function InvestorPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const [inv, setInv] = useState<InvestorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"value" | "name">("value");
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLoading(true);
    setErr(false);
    fetchJson<InvestorResponse>(`/api/investor?slug=${encodeURIComponent(slug)}`, {signal:controller.signal})
      .then((d) => setInv(d.investor))
      .catch(() => {if(!controller.signal.aborted) setErr(true);})
      .finally(() => {if(!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [slug, tick]);

  const holdings = useMemo(() => {
    if (!inv) return [];
    const h = [...inv.holdings];
    // Gewicht = Wert / Gesamtwert -> identische Reihenfolge wie Wert.
    // Deshalb bieten wir Wert (Größe) und Name (A–Z) als echte Alternativen an.
    h.sort((a, b) =>
      sort === "name" ? a.company.localeCompare(b.company) : (b.value ?? 0) - (a.value ?? 0),
    );
    return h;
  }, [inv, sort]);

  if (loading) return <SkeletonPage />;
  if (err) return <ErrorRetry onRetry={() => setTick((t) => t + 1)} />;
  if (!inv)
    return (
      <div className="py-16 text-center text-[15px] text-subtle">
        Investor nicht gefunden.{" "}
        <Link href="/discover" className="text-ink underline">
          Zurück zu Entdecken
        </Link>
      </div>
    );

  const stats = [
    { label: "Portfolio-Wert", value: abbrevMoney(inv.value) },
    { label: "Positionen", value: inv.positions.toLocaleString("de-DE") },
    { label: "Stand", value: formatDate(inv.asOf) },
  ];

  const buys = inv.trades.filter((t) => t.txnType === "buy").length;
  const sells = inv.trades.filter((t) => t.txnType === "sell").length;
  const moves = [
    { label: "Aufstockungen", value: buys, color: "rgb(var(--bull-fill))" },
    { label: "Bestandsabbau", value: sells, color: "rgb(var(--bear-fill))" },
  ];
  const moveTotal = buys + sells;

  return (
    <div className="space-y-8">
      <div className="aura-header space-y-5" style={{ ["--aura" as string]: "var(--aura-investor)" }}>
        <DetailTopBar back="/discover?tab=investors" label="Investoren" action={<FollowButton kind="investor" id={inv.slug} />} />

        <div className="fade-up flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar name={inv.person ?? inv.fund} size={96} className="shadow-[0_10px_30px_rgb(0_0_0/0.14)]" />
          <div className="min-w-0 flex-1">
            <h1 className="large-title">{inv.person ?? inv.fund}</h1>
            <div className="mt-1 text-[15px] text-subtle">{inv.fund} · 13F-Bericht vom {formatDate(inv.asOf)}</div>
          </div>
        </div>
        {inv.bio && <p className="fade-up max-w-2xl text-[17px] leading-relaxed text-ink/80">{inv.bio}</p>}

        <div className="fade-up"><StatRow items={stats} /></div>
      </div>

      <DepotSkyline holdings={inv.holdings} />

      <AllocationBar holdings={inv.holdings} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Alle Positionen</h2>
          <SegmentedControl label="Sortierung" size="sm" options={[["value", "Wert"], ["name", "Name"]] as const} value={sort} onChange={setSort} />
        </div>

        <div className="card overflow-hidden">
          {holdings.map((h, i) => {
            const company = companyName(h.ticker, h.securityName);
            return (
              <div
                key={`${h.ticker ?? h.securityName}-${i}`}
                className="relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-[4.25rem] after:right-0 after:h-px after:bg-hair last:after:hidden"
              >
                <CompanyLogo ticker={h.ticker} company={company} size={40} />
                <div className="min-w-0 flex-1">
                  {h.ticker ? (
                    <Link
                      href={`/stock/${h.ticker}`}
                      className="block truncate text-[15px] font-semibold hover:underline"
                    >
                      {company}
                    </Link>
                  ) : (
                    <div className="truncate text-[15px] font-semibold">{company}</div>
                  )}
                  <div className="text-[13px] text-subtle">
                    {fixTicker(h.ticker, company) ?? "—"}
                    {h.putCall ? ` · ${h.putCall}` : ""}
                  </div>
                </div>
                <div className="w-28 text-right">
                  <div className="text-[15px] font-semibold tabular-nums">{weightPct(h.weight)}</div>
                  <div className="text-[13px] tabular-nums text-subtle">{abbrevMoney(h.value)}</div>
                </div>
              </div>
            );
          })}
          {holdings.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">
              Keine 13F-Positionen vorhanden. (13F wird bis zu 45 Tage nach Quartalsende
              gemeldet.)
            </div>
          )}
        </div>
      </section>

      {moveTotal > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Bewegungen im Quartal</h2>
          <div className="card flex flex-col items-center gap-6 p-5 sm:flex-row">
            <Donut
              segments={moves}
              centerTop={`${Math.round((buys / moveTotal) * 100)} %`}
              centerBottom="Aufstockungen"
            />
            <div className="w-full flex-1 space-y-2.5">
              {moves.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-ink">{s.label}</span>
                  <span className="text-xs text-subtle">{s.value} Positionen</span>
                  <span className="ml-auto font-semibold">
                    {Math.round((s.value / moveTotal) * 100)} %
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Letzte Meldungen</h2>
        <TradeFeed
          rows={inv.trades}
          showActor={false}
          empty="Noch keine gemeldeten Umschichtungen."
        />
      </section>

      <p className="text-[13px] leading-relaxed text-subtle">13F-Berichte zeigen Quartalsbestände. Veränderungen sind keine datierten Trades. Aktienwerte und Gewichte schließen Optionspositionen aus. Personen sind eine redaktionelle Zuordnung zum Fonds, keine Bestätigung der heutigen Anlageverantwortung.</p>
    </div>
  );
}
