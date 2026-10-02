"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { Icon } from "@/components/Icon";
import { normTicker } from "@/components/MatchSheet";
import { Sheet } from "@/components/Sheet";
import { getResolveCache, getUserMap, resolveInstrument } from "@/lib/instruments";
import { formatDate } from "@/lib/format";
import { currencySymbol, loadCurrency } from "@/lib/money";
import { addTxn, EVENT, getTxns, makeTxn, parseNum, positionsFrom } from "@/lib/portfolio";
import { useQuotes } from "@/lib/useQuotes";

/**
 * Shares of a stock held in the Portfolio on this device. Broker imports key
 * positions by ISIN, so each position is resolved to its price symbol the way
 * the Portfolio page does before it is compared.
 */
export function heldShares(ticker: string): number {
  const T = normTicker(ticker);
  const userMap = getUserMap();
  const cache = getResolveCache();
  let n = 0;
  for (const p of positionsFrom(getTxns())) {
    if (p.shares <= 0) continue;
    const symbol = normTicker(p.ticker) === T ? T : resolveInstrument(p.ticker, null, null, userMap, cache).symbol;
    if (symbol && normTicker(symbol) === T) n += p.shares;
  }
  return n;
}

function useHeld(ticker: string): number {
  const [held, setHeld] = useState(0);
  useEffect(() => {
    const sync = () => setHeld(heldShares(ticker));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [ticker]);
  return held;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "1,234.5" without trailing zeros, for a prefilled price. */
const plain = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 2 : 4, useGrouping: false });

/**
 * "Add to portfolio" on a stock page (after Eaves): a sheet that books a
 * purchase into the Portfolio on this device. Shows "In portfolio" once the
 * stock is held; tapping it again adds more.
 */
export function AddToPortfolio({ ticker, company, price, priceCurrency }: { ticker: string; company: string; price: number | null; priceCurrency: string | null }) {
  const held = useHeld(ticker);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-capsule !min-h-10 !px-4 !text-[14px]" aria-haspopup="dialog">
        {held > 0 ? <Icon name="tick" className="h-4 w-4" /> : <Icon name="plus" className="h-4 w-4" />}
        {held > 0 ? "In portfolio" : "Add to portfolio"}
      </button>
      {open && <AddSheet ticker={ticker} company={company} held={held} price={price} priceCurrency={priceCurrency} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddSheet({ ticker, company, held, price, priceCurrency, onClose }: { ticker: string; company: string; held: number; price: number | null; priceCurrency: string | null; onClose: () => void }) {
  const [cur] = useState(() => loadCurrency());
  // The quote is in the listing's currency; the Portfolio books in its own.
  const foreign = !!priceCurrency && priceCurrency !== cur;
  const fxSymbol = foreign ? `${priceCurrency}${cur}=X` : "";
  const fx = useQuotes(fxSymbol ? [fxSymbol] : [])[fxSymbol];
  const local = price === null ? null : foreign ? (fx ? price * fx.price : null) : price;

  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [touched, setTouched] = useState(false);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  useEffect(() => {
    if (!touched && local !== null) setCost(plain(local));
  }, [local, touched]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = parseNum(shares);
    const p = parseNum(cost);
    if (!Number.isFinite(n) || n <= 0) return setError("Please enter a number of shares above 0.");
    if (!Number.isFinite(p) || p <= 0) return setError("Please enter the price you paid per share.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) return setError("Please pick a purchase date that isn’t in the future.");
    // Yahoo writes share classes with a dash (BRK-B), which the Portfolio prices by.
    const symbol = ticker.toUpperCase().replace(/^([A-Z]+)\.([A-Z])$/, "$1-$2");
    try {
      addTxn(makeTxn({ kind: "buy", ticker: symbol, date, shares: n, price: p, name: company, assetClass: "STOCK", currency: cur }));
    } catch {
      return setError("Your Portfolio couldn’t be saved on this device. Please check the browser storage.");
    }
    setError(null);
    setDone(n);
  };

  const sym = currencySymbol(cur).trim();
  return (
    <Sheet
      title={done !== null ? "Added to your Portfolio" : held > 0 ? `Add more ${company}` : `Add ${company}`}
      subtitle={
        done !== null
          ? `${done.toLocaleString("en-US")} ${done === 1 ? "share" : "shares"} of ${company} on ${formatDate(date)}.`
          : held > 0
          ? `You hold ${held.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${held === 1 ? "share" : "shares"}. A new purchase is added to them.`
          : "Book a purchase into your Portfolio. It stays on this device."
      }
      onClose={onClose}
      footer={
        done !== null ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onClose} className="btn-capsule w-full">Done</button>
            <Link href="/me" onClick={onClose} className="btn-primary w-full">Open Portfolio</Link>
          </div>
        ) : (
          <button type="submit" form="add-to-portfolio" className="btn-primary w-full">
            <Icon name="plus" className="h-4 w-4" />
            Add to portfolio
          </button>
        )
      }
    >
      {done === null ? (
        <form id="add-to-portfolio" onSubmit={submit} className="space-y-3 px-4 pb-4 pt-1" noValidate>
          <label className="block">
            <span className="mb-1.5 block px-1 text-[13px] font-medium text-subtle">Shares</span>
            <input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="decimal" placeholder="e.g. 10" className="field h-12" aria-label="Shares" />
          </label>
          <label className="block">
            <span className="mb-1.5 block px-1 text-[13px] font-medium text-subtle">Price per share ({sym})</span>
            <input value={cost} onChange={(e) => { setTouched(true); setCost(e.target.value); }} inputMode="decimal" placeholder={local === null ? "Price you paid" : plain(local)} className="field h-12" aria-label={`Price per share in ${cur}`} />
            {local !== null && !touched && <span className="mt-1.5 block px-1 text-[12px] text-subtle">Latest price{foreign ? `, converted from ${priceCurrency}` : ""}. Change it to what you paid.</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block px-1 text-[13px] font-medium text-subtle">Purchase date</span>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="field h-12" aria-label="Purchase date" />
          </label>
          {error && <p role="alert" className="px-1 text-[13px] font-medium text-bear">{error}</p>}
        </form>
      ) : (
        <div className="flex flex-col items-center px-6 pb-6 pt-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-bull-fill/15 text-bull">
            <Icon name="tick" className="h-7 w-7" />
          </span>
          <p className="mt-3 text-[15px] leading-snug text-subtle">Your Portfolio now tracks {company} with the price and date you entered.</p>
        </div>
      )}
    </Sheet>
  );
}
