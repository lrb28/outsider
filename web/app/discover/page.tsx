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
          <CompanyLogo
            ticker={it.ticker}
            company={it.company}
            size={i === 0 ? 52 : 44}
            rounded="rounded-2xl"
          />
        </div>
      ))}
    </div>
  );
}

function Hero({
  href,
  title,
  blurb,
  items,
  gradient,
}: {
  href: string;
  title: string;
  blurb: string;
  items: CollectionItem[];
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col justify-between rounded-3xl p-5 shadow-card ring-1 ring-black/5 transition hover:shadow-cardhover ${gradient}`}
    >
      <LogoTrio items={items} />
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
        <p className="text-sm text-subtle">
          Worauf das smarte Geld gerade setzt — tippe eine Sammlung an.
        </p>
      </div>

      {loading && <div className="py-10 text-center text-sm text-subtle">Lädt…</div>}

      {!loading && data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Hero
            href="/discover/conviction"
            title="Höchste Überzeugung"
            blurb="Wenn ein Milliardär 15–20 % seines Fonds in eine Aktie steckt, ist das kein Zufall — das ist ein Statement."
            items={data.highestConviction}
            gradient="bg-gradient-to-br from-indigo-100 via-violet-50 to-white"
          />
          <Hero
            href="/discover/mostheld"
            title="Am meisten gehalten"
            blurb="Die Aktien, die die meisten verfolgten Investoren gemeinsam im Depot haben."
            items={data.mostHeld}
            gradient="bg-gradient-to-br from-sky-100 via-cyan-50 to-white"
          />
          <Hero
            href="/discover/biggest"
            title="Größte Positionen"
            blurb="Die wertmäßig größten Einzelwetten unter den Investoren."
            items={data.biggest}
            gradient="bg-gradient-to-br from-emerald-100 via-teal-50 to-white"
          />
        </div>
      )}
    </div>
  );
}
