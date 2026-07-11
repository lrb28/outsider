"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { pct, signalLabel } from "@/lib/format";
import { FeedRow, TradesResponse } from "@/lib/types";

const TYPES = [
  { key: "", label: "All actors" },
  { key: "institution", label: "Institutions" },
  { key: "corporate_insider", label: "Insiders" },
  { key: "politician", label: "Politicians" },
];
const TXN = [
  { key: "", label: "All" },
  { key: "buy", label: "Buys" },
  { key: "sell", label: "Sells" },
  { key: "option", label: "Options" },
];

const typeBadge: Record<string, string> = {
  institution: "Institution",
  corporate_insider: "Insider",
  politician: "Politician",
};

export default function Page() {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [source, setSource] = useState<"database" | "sample">("sample");
  const [type, setType] = useState("");
  const [txnType, setTxnType] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (txnType) p.set("txnType", txnType);
    if (q.trim()) p.set("q", q.trim());
    p.set("limit", "50");
    try {
      const res = await fetch(`/api/trades?${p.toString()}`);
      const data: TradesResponse = await res.json();
      setRows(data.rows);
      setSource(data.source);
    } finally {
      setLoading(false);
    }
  }, [type, txnType, q]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, txnType]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    load();
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Recent trades</h1>
        <p className="text-sm text-muted">
          Unified feed across politicians, corporate insiders and institutions.
        </p>
      </div>

      {source === "sample" && (
        <div className="mb-4 rounded-md border border-edge bg-panel px-3 py-2 text-xs text-muted">
          Showing <strong className="text-slate-200">sample data</strong> (real Scion
          13F, illustrative prices). Connect a database and run ingestion to see
          live rows.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                type === t.key
                  ? "bg-slate-200 text-ink border-slate-200"
                  : "border-edge text-slate-300 hover:border-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {TXN.map((t) => (
            <button
              key={t.key}
              onClick={() => setTxnType(t.key)}
              className={`px-2.5 py-1.5 rounded-md text-xs border ${
                txnType === t.key
                  ? "bg-edge text-slate-100 border-slate-500"
                  : "border-edge text-muted hover:border-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} className="ml-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or ticker…"
            className="bg-panel border border-edge rounded-md px-3 py-1.5 text-sm w-56 outline-none focus:border-slate-500"
          />
        </form>
      </div>

      <div className="rounded-lg border border-edge overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wide text-muted bg-panel">
          <div className="col-span-3">Actor</div>
          <div className="col-span-2">Security</div>
          <div className="col-span-2">Signal</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-1">Disclosed</div>
          <div className="col-span-2 text-right">Since disclosure</div>
        </div>

        {loading && <div className="px-4 py-6 text-sm text-muted">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted">No trades match those filters.</div>
        )}

        {!loading &&
          rows.map((r) => {
            const sig = signalLabel(r.txnType, r.putCall);
            const tone =
              sig.tone === "bull" ? "text-bull" : sig.tone === "bear" ? "text-bear" : "text-slate-300";
            const perf = r.pctSinceDisclosure;
            const perfColor = perf === null ? "text-muted" : perf >= 0 ? "text-bull" : "text-bear";
            return (
              <div
                key={r.id}
                className="grid grid-cols-2 md:grid-cols-12 gap-2 px-4 py-3 border-t border-edge items-center"
              >
                <div className="md:col-span-3 order-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {r.entityName}
                    {r.highlight && <span className="text-[10px] text-amber-400">★</span>}
                  </div>
                  <div className="text-[11px] text-muted">{typeBadge[r.entityType]}</div>
                </div>
                <div className="md:col-span-2 order-3 md:order-2">
                  <div className="text-sm font-mono">{r.ticker ?? "—"}</div>
                  <div className="text-[11px] text-muted truncate">{r.securityName}</div>
                </div>
                <div className={`md:col-span-2 order-4 md:order-3 text-sm font-medium ${tone}`}>
                  {sig.text}
                </div>
                <div className="md:col-span-2 order-5 md:order-4 text-sm">{r.sizeDisplay}</div>
                <div className="md:col-span-1 order-6 md:order-5 text-xs text-muted">
                  {r.disclosedAt ?? "—"}
                </div>
                <div className="md:col-span-2 order-2 md:order-6 text-right">
                  <div className={`text-sm font-semibold ${perfColor}`}>{pct(perf)}</div>
                  <a
                    href={r.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-muted hover:text-slate-300 underline"
                  >
                    filing
                  </a>
                </div>
              </div>
            );
          })}
      </div>

      <p className="text-[11px] text-muted mt-3">
        “Since disclosure” = price change from the first trading day the public
        could act (disclosure date) to the latest close. Entity profile pages add
        “since trade date”.
      </p>
    </div>
  );
}
