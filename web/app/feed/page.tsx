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

  const chip = (active: boolean) =>
    active
      ? "bg-brand text-white"
      : "bg-white/10 text-slate-300 ring-1 ring-white/10 hover:bg-white/15";

  return (
    <div className="rounded-3xl bg-slate-950 p-5 text-slate-100 sm:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Feed</h1>
        <p className="text-sm text-slate-400">
          Alle Trades von Politikern, Insidern und Investoren — tippe für Details.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${chip(type === t.key)}`}
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
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${chip(txnType === t.key)}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} className="ml-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name oder Ticker…"
            className="w-52 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </form>
      </div>

      <TradeFeed rows={rows} loading={loading} dark />

      <p className="mt-3 text-[11px] text-slate-500">
        „Seit Offenlegung“ = Kursänderung vom ersten Handelstag, an dem die Öffentlichkeit
        reagieren konnte, bis zum letzten Schlusskurs.
      </p>
    </div>
  );
}
