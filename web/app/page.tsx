"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { avatarColor, initials, pct, signalLabel } from "@/lib/format";
import { FeedRow, TradesResponse } from "@/lib/types";

interface Stats {
  entities: number;
  institutions: number;
  insiders: number;
  politicians: number;
  trades: number;
}

const TYPES = [
  { key: "", label: "Alle" },
  { key: "institution", label: "Institutionen" },
  { key: "corporate_insider", label: "Insider" },
  { key: "politician", label: "Politiker" },
];
const TXN = [
  { key: "", label: "Alle" },
  { key: "buy", label: "Käufe" },
  { key: "sell", label: "Verkäufe" },
];
const TYP: Record<string, string> = {
  institution: "Institution",
  corporate_insider: "Insider",
  politician: "Politiker",
};

const GRID = "md:grid-cols-[1.9fr_1fr_1.1fr_1fr_0.8fr]";

export default function Page() {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [source, setSource] = useState<"database" | "sample">("sample");
  const [type, setType] = useState("");
  const [txnType, setTxnType] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

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

  const cards = stats
    ? [
        { label: "Verfolgte Akteure", value: stats.entities },
        { label: "Institutionen", value: stats.institutions },
        { label: "Insider", value: stats.insiders },
        { label: "Politiker", value: stats.politicians },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="text-2xl font-semibold tracking-tight">
              {c.value.toLocaleString("de-DE")}
            </div>
            <div className="mt-0.5 text-xs text-subtle">{c.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Letzte Trades</h1>
        <p className="text-sm text-subtle">
          Einheitlicher Feed über Politiker, Insider und Investoren.
        </p>
      </div>

      {source === "sample" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Beispieldaten — verbinde die Datenbank, um Live-Trades zu sehen.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                type === t.key
                  ? "bg-brand text-white shadow-card"
                  : "bg-white text-ink ring-1 ring-hair hover:ring-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TXN.map((t) => (
            <button
              key={t.key}
              onClick={() => setTxnType(t.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                txnType === t.key
                  ? "bg-slate-900 text-white"
                  : "bg-white text-subtle ring-1 ring-hair hover:ring-slate-300"
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
            placeholder="Name oder Ticker suchen…"
            className="w-56 rounded-full border border-hair bg-white px-4 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div
          className={`hidden ${GRID} gap-3 border-b border-hair px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-subtle md:grid`}
        >
          <div>Akteur</div>
          <div>Wertpapier</div>
          <div>Signal</div>
          <div>Größe</div>
          <div className="text-right">Seit Offenlegung</div>
        </div>

        {loading && <div className="px-4 py-10 text-center text-sm text-subtle">Lädt…</div>}
        {!loading && rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-subtle">
            Keine Trades für diese Filter.
          </div>
        )}

        {!loading &&
          rows.map((r) => {
            const sig = signalLabel(r.txnType, r.putCall);
            const badge =
              sig.tone === "bull"
                ? "bg-emerald-50 text-emerald-700"
                : sig.tone === "bear"
                ? "bg-rose-50 text-rose-700"
                : "bg-slate-100 text-slate-600";
            const perf = r.pctSinceDisclosure;
            const perfCls = perf === null ? "text-subtle" : perf >= 0 ? "text-bull" : "text-bear";
            return (
              <div
                key={r.id}
                className={`grid grid-cols-1 ${GRID} items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(
                      r.entityName,
                    )}`}
                  >
                    {initials(r.entityName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{r.entityName}</span>
                      {r.highlight && <span className="text-amber-500">★</span>}
                    </div>
                    <div className="text-xs text-subtle">{TYP[r.entityType]}</div>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-sm font-medium">{r.ticker ?? "—"}</div>
                  <div className="truncate text-xs text-subtle">{r.securityName}</div>
                </div>
                <div>
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${badge}`}>
                    {sig.text}
                  </span>
                </div>
                <div className="text-sm">
                  {r.sizeDisplay}
                  <div className="text-xs text-subtle">{r.disclosedAt ?? "—"}</div>
                </div>
                <div className="md:text-right">
                  <div className={`text-sm font-semibold ${perfCls}`}>{pct(perf)}</div>
                  <a
                    href={r.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-subtle underline hover:text-brand"
                  >
                    Beleg
                  </a>
                </div>
              </div>
            );
          })}
      </div>

      <p className="text-[11px] text-subtle">
        „Seit Offenlegung" = Kursänderung vom ersten Handelstag, an dem die Öffentlichkeit
        reagieren konnte, bis zum letzten Schlusskurs.
      </p>
    </div>
  );
}
