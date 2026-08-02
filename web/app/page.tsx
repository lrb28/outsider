"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { SkeletonList } from "@/components/Skeleton";
import { TradeDetailModal } from "@/components/TradeDetailModal";
import { Watchlist } from "@/components/Watchlist";
import { abbrevMoney, companyName, investorPerson, pct, signalLabel } from "@/lib/format";
import { getMyHoldings } from "@/lib/myportfolio";
import {
  CollectionItem,
  DiscoverData,
  FeedRow,
  InvestorRow,
  InvestorsResponse,
  MatchResponse,
  MatchRow,
  TradesResponse,
} from "@/lib/types";

/* ── Gateway hero card (Eaves-style: floating logos on a gradient) ────────── */
const LOGO_SPOTS = [
  { left: "16%", top: "34%", rot: -8, size: 58 },
  { left: "52%", top: "10%", rot: 7, size: 66 },
  { left: "46%", top: "52%", rot: -3, size: 54 },
];

function GatewayCard({
  href,
  title,
  subtitle,
  gradient,
  items,
}: {
  href: string;
  title: string;
  subtitle: string;
  gradient: string;
  items: CollectionItem[];
}) {
  return (
    <Link
      href={href}
      className={`press relative flex h-72 w-[300px] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-3xl p-5 shadow-card ring-1 ring-black/5 hover:-translate-y-0.5 hover:shadow-cardhover ${gradient}`}
    >
      <div className="absolute inset-x-0 top-0 h-44">
        {items.slice(0, 3).map((it, i) => {
          const s = LOGO_SPOTS[i];
          return (
            <div
              key={(it.ticker ?? it.company) + i}
              className="animate-floaty absolute drop-shadow-md"
              style={
                {
                  left: s.left,
                  top: s.top,
                  "--rot": `${s.rot}deg`,
                  animationDelay: `${i * 0.7}s`,
                } as React.CSSProperties
              }
            >
              <CompanyLogo ticker={it.ticker} company={it.company} size={s.size} rounded="rounded-2xl" />
            </div>
          );
        })}
      </div>
      <div>
        <div className="text-lg font-semibold leading-tight tracking-tight text-slate-900">
          {title}
        </div>
        <p className="mt-1 text-sm leading-snug text-slate-600">{subtitle}</p>
      </div>
    </Link>
  );
}

/* ── Trade sentence card (Eaves-style) ────────────────────────────────────── */
function TradeCard({ r, onOpen }: { r: FeedRow; onOpen: () => void }) {
  const sig = signalLabel(r.txnType, r.putCall);
  const verb =
    r.txnType === "buy" ? "kaufte" : r.txnType === "sell" ? "verkaufte" : sig.text.toLowerCase();
  const verbCls =
    sig.tone === "bull" ? "text-bull" : sig.tone === "bear" ? "text-bear" : "text-slate-500";
  const company = companyName(r.ticker, r.securityName);
  const name =
    r.entityType === "institution" ? investorPerson(r.entityName) ?? r.entityName : r.entityName;
  const perf = r.pctSinceDisclosure;
  return (
    <button
      onClick={onOpen}
      className="press w-72 shrink-0 snap-start rounded-3xl bg-white/80 p-4 text-left shadow-card ring-1 ring-black/5 backdrop-blur hover:-translate-y-0.5 hover:shadow-cardhover"
    >
      <div className="relative mb-3 h-12 w-16">
        <Avatar name={r.entityName} size={46} />
        <div className="absolute -bottom-1 left-8 rounded-lg ring-2 ring-white">
          <CompanyLogo ticker={r.ticker} company={company} size={28} rounded="rounded-lg" />
        </div>
      </div>
      <div className="text-sm leading-snug">
        <span className="font-semibold">{name}</span>{" "}
        <span className={`font-medium ${verbCls}`}>{verb}</span>{" "}
        <span className="font-semibold">{company}</span>
      </div>
      <div className="mt-1.5 text-xs text-subtle">
        {r.sizeDisplay}
        {perf != null && (
          <span className={perf >= 0 ? "text-bull" : "text-bear"}> · {pct(perf)}</span>
        )}
      </div>
    </button>
  );
}

/* ── Section shell ────────────────────────────────────────────────────────── */
function Section({
  title,
  moreHref,
  moreLabel = "Alle ›",
  children,
}: {
  title: string;
  moreHref?: string;
  moreLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="fade-up space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {moreHref && (
          <Link href={moreHref} className="text-sm text-brand hover:underline">
            {moreLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function HomePage() {
  const [discover, setDiscover] = useState<DiscoverData | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [instTrades, setInstTrades] = useState<FeedRow[]>([]);
  const [insiderTrades, setInsiderTrades] = useState<FeedRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [depotCount, setDepotCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FeedRow | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/discover").then((r) => r.json() as Promise<DiscoverData>),
      fetch("/api/investors").then((r) => r.json() as Promise<InvestorsResponse>),
      fetch("/api/trades?type=institution&limit=10").then(
        (r) => r.json() as Promise<TradesResponse>,
      ),
      fetch("/api/trades?type=corporate_insider&limit=10").then(
        (r) => r.json() as Promise<TradesResponse>,
      ),
    ])
      .then(([d, iv, inst, ins]) => {
        setDiscover(d);
        setInvestors(iv.rows);
        setInstTrades(inst.rows);
        setInsiderTrades(ins.rows);
      })
      .finally(() => setLoading(false));

    const hs = getMyHoldings();
    setDepotCount(hs.length);
    if (hs.length > 0) {
      fetch(`/api/match?tickers=${encodeURIComponent(hs.map((h) => h.ticker).join(","))}`)
        .then((r) => r.json() as Promise<MatchResponse>)
        .then((d) => setMatches(d.rows.slice(0, 5)))
        .catch(() => {});
    }
  }, []);

  const spotlight = investors.filter((i) => i.person).slice(0, 10);

  return (
    <div className="space-y-9">
      {/* Gateway hero */}
      {discover && (
        <div className="no-scrollbar fade-up -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1">
          <GatewayCard
            href="/discover/boughtq"
            title="Frische Käufe der Investoren"
            subtitle="Diese Aktien kaufen die Profis gerade am häufigsten."
            gradient="bg-gradient-to-b from-sky-200 via-sky-100 to-blue-50"
            items={discover.mostBoughtQ}
          />
          <GatewayCard
            href="/discover/insiderbuys"
            title="Insider greifen zu"
            subtitle="Wo Führungskräfte gerade eigene Aktien kaufen."
            gradient="bg-gradient-to-b from-emerald-200 via-emerald-100 to-teal-50"
            items={discover.insiderBuys}
          />
          <GatewayCard
            href="/discover/conviction"
            title="Die mutigsten Wetten"
            subtitle="Wenn ein Milliardär alles auf eine Karte setzt."
            gradient="bg-gradient-to-b from-indigo-200 via-violet-100 to-purple-50"
            items={discover.highestConviction}
          />
          <GatewayCard
            href="/discover/biggest"
            title="Die größten Positionen"
            subtitle="Die wertvollsten Einzelwetten des smarten Geldes."
            gradient="bg-gradient-to-b from-amber-200 via-orange-100 to-yellow-50"
            items={discover.biggest}
          />
        </div>
      )}

      <Watchlist />

      {/* Portfolio matches */}
      {depotCount > 0 && matches.length > 0 && (
        <Section title="Portfolio-Matches" moreHref="/me" moreLabel="Mein Depot ›">
          <div className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1">
            {matches.map((m) => {
              const matchPct = Math.min(100, Math.round((m.sharedCount / depotCount) * 100));
              return (
                <Link
                  key={m.slug}
                  href={`/investor/${m.slug}`}
                  className="press flex w-56 shrink-0 snap-start flex-col items-center rounded-3xl bg-white/80 p-5 text-center shadow-card ring-1 ring-black/5 backdrop-blur hover:-translate-y-0.5 hover:shadow-cardhover"
                >
                  <Avatar name={m.person ?? m.fund} size={64} />
                  <div className="mt-2 w-full truncate text-sm font-semibold">
                    {m.person ?? m.fund}
                  </div>
                  <div className="mt-1 text-xl font-bold text-brand">
                    {matchPct} % <span className="text-xs font-medium text-subtle">Match</span>
                  </div>
                  <div className="mt-2 flex items-center">
                    {m.sharedTickers.slice(0, 3).map((t, i) => (
                      <div
                        key={t}
                        style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }}
                        className="rounded-lg ring-2 ring-white"
                      >
                        <CompanyLogo ticker={t} company={t} size={26} rounded="rounded-lg" />
                      </div>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* Spotlight */}
      {spotlight.length > 0 && (
        <Section title="Im Rampenlicht" moreHref="/portfolio">
          <div className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1">
            {spotlight.map((iv) => (
              <Link
                key={iv.slug}
                href={`/investor/${iv.slug}`}
                className="press w-40 shrink-0 snap-start"
              >
                <div className="flex h-40 items-center justify-center rounded-3xl bg-gradient-to-b from-sky-200 via-sky-100 to-blue-50 shadow-card ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-cardhover">
                  <Avatar name={iv.person ?? iv.fund} size={92} />
                </div>
                <div className="mt-2 px-1">
                  <div className="truncate text-sm font-semibold">{iv.person ?? iv.fund}</div>
                  <div className="text-xs text-subtle">{abbrevMoney(iv.value)}</div>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Recent investor trades */}
      <Section title="Letzte Investoren-Trades" moreHref="/feed" moreLabel="Zum Feed ›">
        {loading ? (
          <SkeletonList n={3} />
        ) : instTrades.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-subtle shadow-card">
            Noch keine Investoren-Trades.
          </div>
        ) : (
          <div className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1">
            {instTrades.map((r) => (
              <TradeCard key={r.id} r={r} onOpen={() => setSelected(r)} />
            ))}
          </div>
        )}
      </Section>

      {/* Recent insider trades */}
      <Section title="Letzte Insider-Trades" moreHref="/feed" moreLabel="Zum Feed ›">
        {loading ? (
          <SkeletonList n={3} />
        ) : insiderTrades.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-subtle shadow-card">
            Noch keine Insider-Trades.
          </div>
        ) : (
          <div className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1">
            {insiderTrades.map((r) => (
              <TradeCard key={r.id} r={r} onOpen={() => setSelected(r)} />
            ))}
          </div>
        )}
      </Section>

      {selected && <TradeDetailModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
