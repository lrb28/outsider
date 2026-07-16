"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { TradeFeed } from "@/components/TradeFeed";
import { FeedRow, TradesResponse } from "@/lib/types";

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

export default function FeedPage() {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [type, setType] = useState("");
  const [txnType, setTxnType] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (txnType) p.set("txnType", txnType);
    if (q.trim()) p.set("q", q.trim());
    p.set("limit", "60");
    try {
      const res = await fetch(`/api/trades?${p.toString()}`);
      const data: TradesResponse = await res.json();
      setRows(data.rows);
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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Feed</h1>
        <p className="text-sm text-subtle">
          Alle Trades von Politikern, Insidern und Investoren — tippe eine Zeile für Details.
        </p>
      </div>

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

      <TradeFeed rows={rows} loading={loading} />

      <p className="text-[11px] text-subtle">
        „Seit Offenlegung“ = Kursänderung vom ersten Handelstag, an dem die Öffentlichkeit
        reagieren konnte, bis zum letzten Schlusskurs.
      </p>
    </div>
  );
}
