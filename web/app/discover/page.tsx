"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { SkeletonList } from "@/components/Skeleton";
import { CollectionInvestor, CollectionItem, DiscoverData } from "@/lib/types";

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
      className={`flex flex-col justify-between rounded-3xl p-5 shadow-card ring-1 ring-black/5 transition hover:shadow-cardhover ${gradient}`}
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
        <p className="text-sm text-subtle">Worauf das smarte Geld gerade setzt — tippe eine Sammlung an.</p>
      </div>

      {loading && <SkeletonList n={5} />}

      {!loading && data && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-subtle">Aktien</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Hero
                href="/discover/boughtq"
                title="Meistgekauft (Quartal)"
                blurb="Die Aktien, die die verfolgten Investoren zuletzt am häufigsten neu gekauft haben."
                gradient="bg-gradient-to-br from-amber-100 via-orange-50 to-white"
                visual={<LogoTrio items={data.mostBoughtQ} />}
              />
              <Hero
                href="/discover/mostheld"
                title="Am meisten gehalten"
                blurb="Aktien, die die meisten verfolgten Investoren gemeinsam im Depot haben."
                gradient="bg-gradient-to-br from-sky-100 via-cyan-50 to-white"
                visual={<LogoTrio items={data.mostHeld} />}
              />
              <Hero
                href="/discover/conviction"
                title="Höchste Überzeugung"
                blurb="Wenn ein Milliardär 15–20 % seines Fonds in eine Aktie steckt — ein Statement."
                gradient="bg-gradient-to-br from-indigo-100 via-violet-50 to-white"
                visual={<LogoTrio items={data.highestConviction} />}
              />
              <Hero
                href="/discover/biggest"
                title="Größte Positionen"
                blurb="Die wertmäßig größten Einzelwetten unter den Investoren."
                gradient="bg-gradient-to-br from-emerald-100 via-teal-50 to-white"
                visual={<LogoTrio items={data.biggest} />}
              />
              <Hero
                href="/discover/insiderbuys"
                title="Insider kaufen"
                blurb="Aktien, deren eigene Führungskräfte zuletzt am häufigsten zugekauft haben."
                gradient="bg-gradient-to-br from-lime-100 via-green-50 to-white"
                visual={<LogoTrio items={data.insiderBuys} />}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-subtle">Investoren</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Hero
                href="/discover/biggestfunds"
                title="Größte Fonds"
                blurb="Die verfolgten Investoren mit dem größten gemeldeten Portfolio."
                gradient="bg-gradient-to-br from-rose-100 via-pink-50 to-white"
                visual={<FaceTrio people={data.biggestFunds} />}
              />
              <Hero
                href="/discover/concentrated"
                title="Am konzentriertesten"
                blurb="Investoren, die den größten Anteil in eine einzige Aktie stecken."
                gradient="bg-gradient-to-br from-slate-100 via-slate-50 to-white"
                visual={<FaceTrio people={data.mostConcentrated} />}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-subtle">Politiker</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Hero
                href="/discover/politicians"
                title="Aktivste Politiker"
                blurb="Kongressmitglieder mit den meisten gemeldeten Aktien-Trades."
                gradient="bg-gradient-to-br from-blue-100 via-sky-50 to-white"
                visual={<FaceTrio people={data.topPoliticians} />}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
