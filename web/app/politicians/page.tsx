"use client";

import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { ErrorRetry } from "@/components/ErrorRetry";
import { SkeletonList } from "@/components/Skeleton";
import { EmptyState, ListCard, ListRow, PageTitle, SegmentedControl, politicianLine } from "@/components/ui";
import { fetchCatalogue } from "@/lib/fetchJson";
import { formatDate } from "@/lib/format";
import type { PoliticianRow, PoliticiansResponse } from "@/lib/types";

type Party = "all" | "D" | "R";

export default function PoliticiansPage() {
  const [rows, setRows] = useState<PoliticianRow[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [party, setParty] = useState<Party>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    setError(false);
    fetchCatalogue<PoliticiansResponse>("/api/politicians")
      .then((d) => setRows(d.rows))
      .catch(() => setError(true));
  }, [retry]);

  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("en-US");
    return (rows ?? []).filter((p) => (party === "all" || p.party === party) && (!needle || `${p.name} ${p.seat ?? ""}`.toLocaleLowerCase("en-US").includes(needle)));
  }, [rows, party, q]);

  return (
    <div className="space-y-6">
      <PageTitle title="Politicians" subtitle="Stock trades by members of the US House of Representatives, from their STOCK Act filings." />
      <div className="fade-up flex flex-wrap items-center gap-3">
        <SegmentedControl label="Party" options={[["all", "All"], ["D", "Democrats"], ["R", "Republicans"]] as const} value={party} onChange={setParty} />
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Name or district" aria-label="Filter politicians" className="field min-h-10 max-w-xs" />
      </div>

      {error && <ErrorRetry onRetry={() => setRetry((r) => r + 1)} />}
      {rows === null && !error && <SkeletonList n={8} />}
      {rows !== null && shown.length === 0 && <EmptyState icon="people" title="No matches">Adjust the filter.</EmptyState>}
      {shown.length > 0 && (
        <ListCard className="fade-up">
          {shown.map((p) => (
            <ListRow
              key={p.slug}
              href={`/politician/${p.slug}`}
              leading={<Avatar name={p.name} src={p.photo} kind="politician" size={44} />}
              title={p.name}
              subtitle={politicianLine(p.party, p.seat)}
              trailing={
                <>
                  <div className="text-[15px] font-semibold tabular-nums">{p.trades} trades</div>
                  <div className="text-[13px] text-subtle">{formatDate(p.lastTrade)}</div>
                </>
              }
            />
          ))}
        </ListCard>
      )}
      <p className="text-[13px] text-subtle">Scanned filings (image PDFs) can’t be read automatically yet and are therefore missing. The US Senate is left out on purpose.</p>
    </div>
  );
}
