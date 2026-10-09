"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "./fetchJson";
export interface Quote { price:number;prevClose:number|null;changePct:number|null;currency:string|null;marketState:string|null;t:number; }
/** Live quotes, polled every minute; `reload` fetches them now (pull to refresh) and resolves once they are in. */
export function useQuoteFeed(tickers: string[], intervalMs = 60_000) {
  const [quotes,setQuotes] = useState<Record<string,Quote>>({});
  const loader = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const key = [...new Set(tickers.filter(Boolean).map(t => t.toUpperCase()))].sort().join(",");
  useEffect(() => {
    setQuotes({}); loader.current = async () => {}; if (!key) return;
    const controller = new AbortController(); let busy: Promise<void> | null = null;
    function load(force = false): Promise<void> {
      if (busy) return busy;
      if (controller.signal.aborted || (!force && document.visibilityState === "hidden")) return Promise.resolve();
      busy = (async () => {
        const next: Record<string,Quote> = {}; const names = key.split(",");
        try { for (let i=0;i<names.length;i+=30) { const result = await fetchJson<{quotes:Record<string,Quote>}>(`/api/quotes?tickers=${encodeURIComponent(names.slice(i,i+30).join(","))}`,{signal:controller.signal,tries:1});Object.assign(next,result.quotes); } }
        catch { /* The new snapshot omits unavailable quotes; callers show EOD with its date. */ }
        finally { if(!controller.signal.aborted) setQuotes(next); busy = null; }
      })();
      return busy;
    }
    loader.current = load;
    const onVisible = () => void load();
    void load();const timer = setInterval(onVisible,intervalMs);document.addEventListener("visibilitychange",onVisible);
    return () => {controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);};
  },[key,intervalMs]);
  const reload = useCallback(() => loader.current(true), []);
  return { quotes, reload };
}
export function useQuotes(tickers: string[], intervalMs = 60_000) {
  return useQuoteFeed(tickers, intervalMs).quotes;
}
