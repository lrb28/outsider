"use client";

import { useEffect, useState } from "react";

import { fetchJson } from "./fetchJson";
import { ASSET_META, type ListingMeta } from "./sectors";

// Listing data (quote type, sector) for Depot symbols the curated list does
// not cover, cached in the browser for a month: sectors hardly change.
const KEY = "aura:listing-meta:v1";
const MAX_AGE = 30 * 24 * 60 * 60_000;

type Stored = Record<string, { at: number; meta: ListingMeta | null }>;

function load(): Stored {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") as Stored;
  } catch {
    return {};
  }
}

function save(s: Stored) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* full or blocked storage: the data is only a convenience */
  }
}

export function useAssetMeta(symbols: string[]): Record<string, ListingMeta> {
  const [meta, setMeta] = useState<Record<string, ListingMeta>>({});
  const key = [...new Set(symbols.map((s) => s.toUpperCase()))].filter((s) => !ASSET_META[s] && !/-USD$/.test(s)).sort().join(",");

  useEffect(() => {
    if (!key) return setMeta({});
    const names = key.split(",");
    const stored = load();
    const now = Date.now();
    const known: Record<string, ListingMeta> = {};
    for (const n of names) {
      const hit = stored[n];
      if (hit?.meta && now - hit.at < MAX_AGE) known[n] = hit.meta;
    }
    setMeta(known);
    // Misses are retried after a day, hits after a month.
    const need = names.filter((n) => !stored[n] || now - stored[n].at > (stored[n].meta ? MAX_AGE : 86_400_000));
    if (need.length === 0) return;
    const controller = new AbortController();
    (async () => {
      const got: Record<string, ListingMeta> = {};
      for (let i = 0; i < need.length; i += 60) {
        try {
          const r = await fetchJson<{ meta: Record<string, ListingMeta> }>(`/api/meta?symbols=${encodeURIComponent(need.slice(i, i + 60).join(","))}`, { signal: controller.signal, tries: 1 });
          Object.assign(got, r.meta);
        } catch {
          if (controller.signal.aborted) return;
        }
      }
      if (controller.signal.aborted) return;
      const next = load();
      for (const n of need) next[n] = { at: Date.now(), meta: got[n] ?? null };
      save(next);
      setMeta((m) => ({ ...m, ...got }));
    })();
    return () => controller.abort();
  }, [key]);

  return meta;
}
