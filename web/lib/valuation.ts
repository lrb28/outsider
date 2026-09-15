import type { Bar } from "./portfolio";
export function quoteUnit(currency: string | null | undefined): {currency:string;scale:number} | null {
  if (currency === "GBp" || currency === "GBX") return {currency:"GBP",scale:0.01};
  if (currency === "ZAc") return {currency:"ZAR",scale:0.01};
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return null;
  return {currency,scale:1};
}
export function fxSymbol(quote: string | null | undefined, base: string): string | null {
  const unit = quoteUnit(quote);
  return unit && unit.currency !== base ? `${base}${unit.currency}=X` : null;
}
export function rateAt(bars: Bar[] | null | undefined, date: string): number | null {
  if (!bars?.length) return null;
  // Latest rate at or before the valuation day; never borrow a future rate.
  let low = 0, high = bars.length - 1, found = -1;
  while (low <= high) { const mid = (low + high) >>> 1; if (bars[mid].date <= date) { found = mid; low = mid+1; } else high = mid-1; }
  const bar = bars[found];
  return bar && Number.isFinite(bar.close) && bar.close > 0 && Date.parse(date) - Date.parse(bar.date) <= 7 * 86400000 ? bar.close : null;
}
export function conversionFactor(quote: string | null | undefined, base: string, fx: Bar[] | null | undefined, date: string): number | null {
  const unit = quoteUnit(quote);
  if (!unit) return null;
  if (unit.currency === base) return unit.scale;
  const rate = rateAt(fx,date);
  return rate === null ? null : unit.scale / rate;
}
export function convertHistory(bars: Bar[], quote: string | null | undefined, base: string, fx: Bar[] | null | undefined): Bar[] {
  return bars.flatMap(bar => {const factor = conversionFactor(quote,base,fx,bar.date);return factor === null ? [] : [{date:bar.date,close:bar.close*factor}];});
}
export function dailyChange(shares: number, price: number, previous: number | null, factor: number | null): number | null {
  return previous !== null && previous > 0 && factor !== null && [shares,price,previous,factor].every(Number.isFinite) ? shares*(price-previous)*factor : null;
}
