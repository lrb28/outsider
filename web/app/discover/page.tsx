"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/CompanyLogo";
import { CollectionItem, DiscoverData } from "@/lib/types";

function LogoTrio({ items }: { items: CollectionItem[] }) {
  const top = items.slice(0, 3);
  return (
    <div className="flex items-center">
      {top.map((it, i) => (
        <div
          key={(it.ticker ?? it.company) + i}
          style={{ marginLeft: i === 0 ? 0 : -10, zIndex: top.length - i }}
          className="rounded-2xl ring-2 ring-white/70"
        >
          <CompanyLogo ticker={it.ticker} company={it.company} size={i === 0 ? 52 : 44} rounded="rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

function Hero({
  id,
  title,
  blurb,
  items,
  gradient,
}: {
  id: string;
  title: string;
  blurb: string;
  items: CollectionItem[];
  gradient: string;
}) {
  return (
    <Link
      href={`#${id}`}
      className={`flex w-72 shrink-0 flex-col justify-between rounded-3xl p-5 shadow-card ring-1 ring-black/5 ${gradient}`}
    >
      <LogoTrio items={items} />
      <div className="mt-6">
        <div className="text-lg font-semibold tracking-tight text-slate-900">{title}</div>
        <p className="mt-1 text-sm leading-snug text-slate-600">{blurb}</p>
      </div>
    </Link>
  );
}

function Collection({
  id,
  title,
  subtitle,
  items,
}: {
  id: string;
  title: string;
  subtitle: string;
  items: CollectionItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
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
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            <Hero
              id="conviction"
              title="Höchste Überzeugung"
              blurb="Wenn ein Milliardär 15–20 % seines Fonds in eine Aktie steckt, ist das kein Zufall — das ist ein Statement."
              items={data.highestConviction}
              gradient="bg-gradient-to-br from-indigo-100 via-violet-50 to-white"
            />
            <Hero
              id="mostheld"
              title="Am meisten gehalten"
              blurb="Die Aktien, die die meisten verfolgten Investoren gemeinsam im Depot haben."
              items={data.mostHeld}
              gradient="bg-gradient-to-br from-sky-100 via-cyan-50 to-white"
            />
            <Hero
              id="biggest"
              title="Größte Positionen"
              blurb="Die wertmäßig größten Einzelwetten unter den Investoren."
              items={data.biggest}
              gradient="bg-gradient-to-br from-emerald-100 via-teal-50 to-white"
            />
          </div>

          <Collection
            id="mostheld"
            title="Am meisten gehalten"
            subtitle="Aktien, die die meisten verfolgten Investoren im Depot haben."
            items={data.mostHeld}
          />
          <Collection
            id="conviction"
            title="Höchste Überzeugung"
            subtitle="Wo ein Investor den größten Anteil seines Portfolios hineinsteckt."
            items={data.highestConviction}
          />
          <Collection
            id="biggest"
            title="Größte Einzelpositionen"
            subtitle="Die wertmäßig größten Wetten unter den verfolgten Investoren."
            items={data.biggest}
          />
        </>
      )}
    </div>
  );
}
