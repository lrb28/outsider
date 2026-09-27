"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "./fetchJson";
export interface Quote { price:number;prevClose:number|null;changePct:number|null;currency:string|null;marketState:string|null;t:number; }
export function useQuotes(tickers: string[], intervalMs = 60_000) {
  const [quotes,setQuotes] = useState<Record<string,Quote>>({});
  const key = [...new Set(tickers.filter(Boolean).map(t => t.toUpperCase()))].sort().join(",");
  useEffect(() => {
    setQuotes({}); if (!key) return;
    const controller = new AbortController(); let busy = false;
    async function load() {
      if (busy || controller.signal.aborted || document.visibilityState === "hidden") return;
      busy = true; const next: Record<string,Quote> = {}; const names = key.split(",");
      try { for (let i=0;i<names.length;i+=30) { const result = await fetchJson<{quotes:Record<string,Quote>}>(`/api/quotes?tickers=${encodeURIComponent(names.slice(i,i+30).join(","))}`,{signal:controller.signal,tries:1});Object.assign(next,result.quotes); } }
      catch { /* The new snapshot omits unavailable quotes; callers show EOD with its date. */ }
      finally { if(!controller.signal.aborted) setQuotes(next); busy = false; }
    }
    void load();const timer = setInterval(load,intervalMs);document.addEventListener("visibilitychange",load);
    return () => {controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",load);};
  },[key,intervalMs]);
  return quotes;
}
