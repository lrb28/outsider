"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AllocationBar } from "@/components/AllocationBar";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Donut } from "@/components/Donut";
import { FollowButton } from "@/components/FollowButton";
import { TradeFeed } from "@/components/TradeFeed";
import { abbrevMoney, companyName, fixTicker, weightPct } from "@/lib/format";
import { InvestorDetail, InvestorResponse } from "@/lib/types";

export default function InvestorPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const [inv, setInv] = useState<InvestorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"value" | "weight">("value");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/investor?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json() as Promise<InvestorResponse>)
      .then((d) => setInv(d.investor))
      .finally(() => setLoading(false));
  }, [slug]);

  const holdings = useMemo(() => {
    if (!inv) return [];
    const h = [...inv.holdings];
    h.sort((a, b) =>
      sort === "weight" ? (b.weight ?? 0) - (a.weight ?? 0) : (b.value ?? 0) - (a.value ?? 0),
    );
    return h;
  }, [inv, sort]);

  if (loading) return <div className="py-16 text-center text-sm text-subtle">Lädt…</div>;
  if (!inv)
    return (
      <div className="py-16 text-center text-sm text-subtle">
        Investor nicht gefunden.{" "}
        <Link href="/portfolio" className="text-brand underline">
          Zurück zum Portfolio
        </Link>
      </div>
    );

  const stats = [
    { label: "Portfolio-Wert", value: abbrevMoney(inv.value) },
    { label: "Positionen", value: inv.positions.toLocaleString("de-DE") },
    { label: "Stand", value: inv.asOf ?? "—" },
  ];

  const buys = inv.trades.filter((t) => t.txnType === "buy").length;
  const sells = inv.trades.filter((t) => t.txnType === "sell").length;
  const moves = [
    { label: "Käufe", value: buys, color: "#16a34a" },
    { label: "Verkäufe", value: sells, color: "#dc2626" },
  ];
  const moveTotal = buys + sells;

  return (
    <div className="space-y-6">
      <Link href="/portfolio" className="inline-block text-sm text-subtle hover:text-ink">
        ‹ Portfolio
      </Link>

      <div className="flex items-start gap-4">
        <Avatar name={inv.person ?? inv.fund} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{inv.person ?? inv.fund}</h1>
          <div className="text-sm text-subtle">{inv.fund}</div>
          {inv.bio && <p className="mt-1 max-w-xl text-sm text-slate-600">{inv.bio}</p>}
        </div>
        <FollowButton kind="investor" id={inv.slug} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="text-lg font-semibold tracking-tight">{s.value}</div>
            <div className="mt-0.5 text-xs text-subtle">{s.label}</div>
          </div>
        ))}
      </div>

      <AllocationBar holdings={inv.holdings} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Portfolio</h2>
          <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-medium">
            {(
              [
                ["value", "Wert"],
                ["weight", "Gewicht"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`rounded-full px-3 py-1 transition ${
                  sort === key ? "bg-white text-ink shadow-card" : "text-subtle"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {holdings.map((h, i) => {
            const company = companyName(h.ticker, h.securityName);
            return (
              <div
                key={`${h.ticker ?? h.securityName}-${i}`}
                className="flex items-center gap-3 border-b border-hair px-4 py-3 last:border-0"
              >
                <CompanyLogo ticker={h.ticker} company={company} size={38} />
                <div className="min-w-0 flex-1">
                  {h.ticker ? (
                    <Link
                      href={`/stock/${h.ticker}`}
                      className="block truncate text-sm font-medium hover:text-brand"
                    >
                      {company}
                    </Link>
                  ) : (
                    <div className="truncate text-sm font-medium">{company}</div>
                  )}
                  <div className="font-mono text-xs text-subtle">
                    {fixTicker(h.ticker, company) ?? "—"}
                    {h.putCall ? ` · ${h.putCall}` : ""}
                  </div>
                </div>
                <div className="w-28 text-right">
                  <div className="text-sm font-semibold">{weightPct(h.weight)}</div>
                  <div className="text-xs text-subtle">{abbrevMoney(h.value)}</div>
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
          <h2 className="text-lg font-semibold tracking-tight">Bewegungen (Quartal)</h2>
          <div className="flex flex-col items-center gap-6 rounded-2xl bg-card p-5 shadow-card sm:flex-row">
            <Donut
              segments={moves}
              centerTop={`${Math.round((buys / moveTotal) * 100)} %`}
              centerBottom="Käufe"
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
        <h2 className="text-lg font-semibold tracking-tight">Letzte Trades</h2>
        <TradeFeed
          rows={inv.trades}
          showActor={false}
          empty="Noch keine gemeldeten Umschichtungen."
        />
      </section>
    </div>
  );
}
