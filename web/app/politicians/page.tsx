"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorRetry } from "@/components/ErrorRetry";
import { fetchCatalogue } from "@/lib/fetchJson";
import { Avatar } from "@/components/Avatar";
import { SkeletonList } from "@/components/Skeleton";
import { formatDate } from "@/lib/format";
import { PoliticianRow, PoliticiansResponse } from "@/lib/types";

export default function PoliticiansPage() {
  const [rows, setRows] = useState<PoliticianRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [error,setError] = useState(false);const [retry,setRetry] = useState(0);
  useEffect(() => {
    setLoading(true);setError(false);
    fetchCatalogue<PoliticiansResponse>("/api/politicians")
      .then((d) => setRows(d.rows))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [retry]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Politiker</h1>
        <p className="text-sm text-subtle">
          Aktien-Trades von US-Kongressmitgliedern aus STOCK-Act-Offenlegungen.
        </p>
      </div>

      {loading && <SkeletonList n={6} />}

      {error && <ErrorRetry onRetry={() => setRetry(r => r+1)}/>}
      <p className="text-sm text-amber-800">Historische Quelle mit erheblichen Datenlücken. <Link href="/status" className="underline">Abdeckung prüfen</Link></p>
      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {rows.map((p) => (
            <Link
              key={p.slug}
              href={`/politician/${p.slug}`}
              className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50"
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
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">
              Noch keine Politiker-Trades geladen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
