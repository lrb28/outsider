"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { FaceStack } from "@/components/FaceStack";
import { FollowButton } from "@/components/FollowButton";
import { SkeletonList } from "@/components/Skeleton";
import { abbrevMoney, formatDate } from "@/lib/format";
import {
  CollectionInvestor,
  CollectionItem,
  DiscoverData,
  InvestorRow,
  InvestorsResponse,
  PoliticianRow,
  PoliticiansResponse,
  StockRow,
  StocksResponse,
} from "@/lib/types";

type Tab = "highlights" | "investors" | "stocks" | "politicians";

const TABS: [Tab, string][] = [
  ["highlights", "Highlights"],
  ["investors", "Investoren"],
  ["stocks", "Aktien"],
  ["politicians", "Politiker"],
];

function LogoTrio({ items }: { items: CollectionItem[] }) {
  return (
    <div className="flex items-center">
      {items.slice(0, 3).map((it, i) => (
        <div
          key={(it.ticker ?? it.company) + i}
          style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }}
          className="rounded-2xl ring-2 ring-white/70"
        >
          <CompanyLogo ticker={it.ticker} company={it.company} size={i === 0 ? 52 : 44} rounded="rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

function FaceTrio({ people }: { people: CollectionInvestor[] }) {
  return (
    <div className="flex items-center">
      {people.slice(0, 3).map((p, i) => (
        <div
          key={p.slug + i}
          style={{ marginLeft: i === 0 ? 0 : -12, zIndex: 3 - i }}
          className="rounded-full ring-2 ring-white"
        >
          <Avatar name={p.person ?? p.fund} size={i === 0 ? 52 : 44} />
        </div>
      ))}
    </div>
  );
}

function Hero({
  href,
  title,
  blurb,
  gradient,
  visual,
}: {
  href: string;
  title: string;
  blurb: string;
  gradient: string;
  visual: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`press lcard-hover flex flex-col justify-between rounded-3xl p-5 shadow-card ring-1 ring-black/5 ${gradient}`}
    >
      {visual}
      <div className="mt-6">
        <div className="flex items-center gap-1 text-lg font-semibold tracking-tight text-slate-900">
          {title} <span className="text-slate-400">›</span>
        </div>
        <p className="mt-1 text-sm leading-snug text-slate-600">{blurb}</p>
      </div>
    </Link>
  );
}

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>("highlights");
  const [data, setData] = useState<DiscoverData | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[] | null>(null);
  const [stocks, setStocks] = useState<StockRow[] | null>(null);
  const [politicians, setPoliticians] = useState<PoliticianRow[] | null>(null);

  useEffect(() => {
    fetch("/api/discover")
      .then((r) => r.json() as Promise<DiscoverData>)
      .then(setData)
      .catch(() => {});
    fetch("/api/investors")
      .then((r) => r.json() as Promise<InvestorsResponse>)
      .then((d) => setInvestors(d.rows))
      .catch(() => setInvestors([]));
    fetch("/api/stocks")
      .then((r) => r.json() as Promise<StocksResponse>)
      .then((d) => setStocks(d.rows))
      .catch(() => setStocks([]));
    fetch("/api/politicians")
      .then((r) => r.json() as Promise<PoliticiansResponse>)
      .then((d) => setPoliticians(d.rows))
      .catch(() => setPoliticians([]));
  }, []);

  const sortedStocks = useMemo(
    () => (stocks ? [...stocks].sort((a, b) => b.investors - a.investors) : null),
    [stocks],
  );

  return (
    <div className="space-y-6">
      <div className="fade-up">
        <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
        <p className="text-sm text-subtle">Worauf das smarte Geld gerade setzt.</p>
      </div>

      {/* Segments */}
      <div className="fade-up inline-flex rounded-full bg-white/70 p-1 ring-1 ring-black/5 backdrop-blur">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`press-sm rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === key
                ? "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                : "text-subtle hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Highlights ─────────────────────────────────────────────────────── */}
      {tab === "highlights" &&
        (!data ? (
          <SkeletonList n={5} />
        ) : (
          <div className="fade-up space-y-8">
            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-subtle">Aktien</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Hero
                  href="/discover/boughtq"
                  title="Meistgekauft (Quartal)"
                  blurb="Die Aktien, die die verfolgten Investoren zuletzt am häufigsten neu gekauft haben."
                  gradient="bg-gradient-to-b from-amber-100 via-orange-50 to-white"
                  visual={<LogoTrio items={data.mostBoughtQ} />}
                />
                <Hero
                  href="/discover/mostheld"
                  title="Am meisten gehalten"
                  blurb="Aktien, die die meisten verfolgten Investoren gemeinsam im Depot haben."
                  gradient="bg-gradient-to-b from-sky-100 via-cyan-50 to-white"
                  visual={<LogoTrio items={data.mostHeld} />}
                />
                <Hero
                  href="/discover/conviction"
                  title="Höchste Überzeugung"
                  blurb="Wenn ein Milliardär 15–20 % seines Fonds in eine Aktie steckt — ein Statement."
                  gradient="bg-gradient-to-b from-indigo-100 via-violet-50 to-white"
                  visual={<LogoTrio items={data.highestConviction} />}
                />
                <Hero
                  href="/discover/biggest"
                  title="Größte Positionen"
                  blurb="Die wertmäßig größten Einzelwetten unter den Investoren."
                  gradient="bg-gradient-to-b from-emerald-100 via-teal-50 to-white"
                  visual={<LogoTrio items={data.biggest} />}
                />
                <Hero
                  href="/discover/insiderbuys"
                  title="Insider kaufen"
                  blurb="Aktien, deren eigene Führungskräfte zuletzt am häufigsten zugekauft haben."
                  gradient="bg-gradient-to-b from-lime-100 via-green-50 to-white"
                  visual={<LogoTrio items={data.insiderBuys} />}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-subtle">
                Investoren & Politiker
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Hero
                  href="/discover/biggestfunds"
                  title="Größte Fonds"
                  blurb="Die verfolgten Investoren mit dem größten gemeldeten Portfolio."
                  gradient="bg-gradient-to-b from-rose-100 via-pink-50 to-white"
                  visual={<FaceTrio people={data.biggestFunds} />}
                />
                <Hero
                  href="/discover/concentrated"
                  title="Am konzentriertesten"
                  blurb="Investoren, die den größten Anteil in eine einzige Aktie stecken."
                  gradient="bg-gradient-to-b from-slate-100 via-slate-50 to-white"
                  visual={<FaceTrio people={data.mostConcentrated} />}
                />
                <Hero
                  href="/discover/politicians"
                  title="Aktivste Politiker"
                  blurb="Kongressmitglieder mit den meisten gemeldeten Aktien-Trades."
                  gradient="bg-gradient-to-b from-blue-100 via-sky-50 to-white"
                  visual={<FaceTrio people={data.topPoliticians} />}
                />
              </div>
            </section>
          </div>
        ))}

      {/* ── Investoren ─────────────────────────────────────────────────────── */}
      {tab === "investors" &&
        (investors === null ? (
          <SkeletonList n={8} />
        ) : (
          <div className="fade-up overflow-hidden rounded-3xl bg-white/80 shadow-card ring-1 ring-black/5 backdrop-blur">
            {investors.map((iv) => (
              <Link
                key={iv.slug}
                href={`/investor/${iv.slug}`}
                className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-white"
              >
                <Avatar name={iv.person ?? iv.fund} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{iv.person ?? iv.fund}</div>
                  <div className="truncate text-xs text-subtle">{iv.fund}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{iv.positions} Positionen</div>
                  <div className="text-xs text-subtle">{abbrevMoney(iv.value)}</div>
                </div>
                <FollowButton kind="investor" id={iv.slug} variant="star" />
                <span className="text-slate-300">›</span>
              </Link>
            ))}
            {investors.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-subtle">Noch keine Daten.</div>
            )}
          </div>
        ))}

      {/* ── Aktien ─────────────────────────────────────────────────────────── */}
      {tab === "stocks" &&
        (sortedStocks === null ? (
          <SkeletonList n={8} />
        ) : (
          <div className="fade-up overflow-hidden rounded-3xl bg-white/80 shadow-card ring-1 ring-black/5 backdrop-blur">
            {sortedStocks.map((s) => (
              <Link
                key={s.ticker}
                href={`/stock/${s.ticker}`}
                className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-white"
              >
                <CompanyLogo ticker={s.ticker} company={s.company} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{s.company}</div>
                  <div className="text-xs text-subtle">
                    {s.investors} {s.investors === 1 ? "Investor" : "Investoren"} ·{" "}
                    {abbrevMoney(s.value)}
                  </div>
                </div>
                <FaceStack names={s.holderNames} />
                {s.ticker && <FollowButton kind="stock" id={s.ticker} variant="star" />}
                <span className="text-slate-300">›</span>
              </Link>
            ))}
            {sortedStocks.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-subtle">Noch keine Daten.</div>
            )}
          </div>
        ))}

      {/* ── Politiker ──────────────────────────────────────────────────────── */}
      {tab === "politicians" &&
        (politicians === null ? (
          <SkeletonList n={6} />
        ) : (
          <div className="fade-up overflow-hidden rounded-3xl bg-white/80 shadow-card ring-1 ring-black/5 backdrop-blur">
            {politicians.map((p) => (
              <Link
                key={p.slug}
                href={`/politician/${p.slug}`}
                className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-white"
              >
                <Avatar name={p.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-subtle">
                    {[p.party, p.chamber].filter(Boolean).join(" · ") || "US-Kongress"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{p.trades} Trades</div>
                  <div className="text-xs text-subtle">{formatDate(p.lastTrade)}</div>
                </div>
                <span className="text-slate-300">›</span>
              </Link>
            ))}
            {politicians.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-subtle">
                Noch keine Politiker-Trades geladen.
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
