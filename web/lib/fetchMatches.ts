import { fetchJson } from './fetchJson';
import type { MatchResponse, MatchRow } from './types';
export async function fetchMatches(symbols: string[], signal?: AbortSignal): Promise<MatchRow[]> {
  const names = [...new Set(symbols.filter(Boolean).map(s => s.toUpperCase()))];
  const merged = new Map<string,MatchRow>();
  for(let i=0;i<names.length;i+=200) {
    const data = await fetchJson<MatchResponse>(`/api/match?tickers=${encodeURIComponent(names.slice(i,i+200).join(','))}`,{signal});
    for (const row of data.rows) {const old = merged.get(row.slug);merged.set(row.slug,old ? {...row,sharedTickers:[...new Set([...old.sharedTickers,...row.sharedTickers])],sharedCount:old.sharedCount+row.sharedCount,invWeight:old.invWeight+row.invWeight} : row);}
  }
  return [...merged.values()].sort((a,b)=>b.sharedCount-a.sharedCount || b.invWeight-a.invWeight);
}
