"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";

import { auraOf, companyName, formatDate, investorPerson, isStaleDate, pct, quarterOf, sourceLink, stockHref, tradeSignal, tradeVerb } from "@/lib/format";
import { fetchJson } from "@/lib/fetchJson";
import { slideSheet, useDragDismiss, useScrollLock, useSwipePager } from "@/lib/sheetGestures";
import type { FeedRow, PricesResponse } from "@/lib/types";

import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";
import { Icon } from "./Icon";
import { PriceChart } from "./PriceChart";
import { SkeletonChart } from "./Skeleton";

const price = (v: number | null) => (v !== null && Number.isFinite(v) ? v.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—");
const TONE = { bull: "text-bull", bear: "text-bear", neutral: "text-ink" } as const;
const KIND: Record<FeedRow["entityType"], string> = { institution: "Investor", corporate_insider: "Insider", politician: "Politician" };

/**
 * One disclosure in detail, as a card that rises from the bottom (after
 * Eaves): the trade as a sentence ("Nancy Pelosi bought NVIDIA"), the same
 * interactive price chart as the stock page (the disclosure is marked) and
 * the figures as one plain list. Given the list it was opened from, the card
 * swipes sideways to the next and previous filing (arrow keys too). Swipe
 * down, tap outside or Escape closes it; the page behind stays put.
 */
export function TradeDetailModal({ row, rows, onClose }: { row: FeedRow; rows?: FeedRow[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [index, setIndex] = useState(() => Math.max(0, rows?.findIndex((r) => r.id === row.id) ?? 0));
  const list = rows && rows.some((r) => r.id === row.id) ? rows : null;
  const current = list ? list[Math.min(index, list.length - 1)] : row;
  const [prices, setPrices] = useState<Record<string, PricesResponse | "error">>({});
  const [retry, setRetry] = useState(0);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const close = useCallback(() => {
    if (closing) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return closeRef.current();
    setClosing(true);
    window.setTimeout(() => closeRef.current(), 260);
  }, [closing]);

  const can = useCallback((dir: 1 | -1) => !!list && index + dir >= 0 && index + dir < list.length, [list, index]);
  const go = useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => Math.min(Math.max(0, i + dir), (list?.length ?? 1) - 1));
      scroller.current?.scrollTo({ top: 0 });
    },
    [list],
  );
  const page = useCallback((dir: 1 | -1) => dialog.current && can(dir) && slideSheet(dialog.current, dir, () => go(dir)), [can, go]);

  useScrollLock();
  useDragDismiss(dialog, scroller, () => closeRef.current());
  useSwipePager(dialog, list ? { can, go } : null);

  useEffect(() => {
    const element = dialog.current;
    const focused = document.activeElement as HTMLElement | null;
    element?.showModal();
    // Focus the sheet itself, not its first button: a ring on the close
    // button as the sheet opens looks like a selection.
    element?.focus({ preventScroll: true });
    return () => {
      element?.close();
      focused?.focus?.({ preventScroll: true });
    };
  }, []);

  // Prices per ticker, kept while paging: an insider series is often one
  // stock many times.
  const ticker = current.ticker;
  const loaded = ticker ? prices[ticker] : undefined;
  useEffect(() => {
    if (!ticker || (loaded && loaded !== "error")) return;
    const controller = new AbortController();
    fetchJson<PricesResponse>(`/api/prices?ticker=${encodeURIComponent(ticker)}`, { signal: controller.signal })
      .then((d) => setPrices((p) => ({ ...p, [ticker]: d })))
      .catch(() => {
        if (!controller.signal.aborted) setPrices((p) => ({ ...p, [ticker]: "error" }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, retry]);

  const r = current;
  const data = loaded && loaded !== "error" ? loaded : null;
  const error = loaded === "error";
  const sig = tradeSignal(r);
  const { verb, tone } = tradeVerb(r);
  const company = companyName(r.ticker, r.securityName);
  const actor = r.entityType === "institution" ? investorPerson(r.entityName) ?? r.entityName : r.entityName;
  const bars = data?.bars ?? [];
  const last = bars[bars.length - 1];
  const stale = isStaleDate(last?.date ?? null);
  const cutoff = r.disclosedAt ? new Date(Date.parse(r.disclosedAt) + 7 * 86400000).toISOString().slice(0, 10) : null;
  const entry = r.disclosedAt ? bars.find((bar) => bar.date >= r.disclosedAt! && bar.date <= cutoff!)?.close ?? null : null;
  const perf = !last || entry === null || entry <= 0 || stale ? null : (last.close - entry) / entry;
  const profile = r.entitySlug ? `/${r.entityType === "institution" ? "investor" : r.entityType === "politician" ? "politician" : "insider"}/${r.entitySlug}` : null;
  const source = sourceLink(r.sourceUrl);
  const quarter = r.entityType === "institution" ? quarterOf(r.reportingDate) : null;
  const facts: [string, ReactNode][] = [
    ["Transaction", <span key="t" className={TONE[sig.tone]}>{sig.text}</span>],
    ["Reported size", r.sizeDisplay],
    [r.entityType === "institution" ? "Report date" : "Trade date", formatDate(r.entityType === "institution" ? r.reportingDate ?? r.txnDate : r.txnDate)],
    ["Disclosed on", formatDate(r.disclosedAt)],
    ["Close after disclosure", price(entry)],
    [`Latest close${last ? ` · ${formatDate(last.date)}` : ""}`, price(last?.close ?? null)],
    [
      "Since disclosure",
      perf === null ? "—" : (
        <span key="p" className={perf >= 0 ? "text-bull" : "text-bear"}>
          {perf >= 0 ? "▲" : "▼"} {pct(perf)}
        </span>
      ),
    ],
  ];
  if (r.transactionCode) facts.push(["Form 4 code", r.transactionCode]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-closing={closing ? "" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") page(1);
        else if (event.key === "ArrowLeft") page(-1);
      }}
      onClick={(event) => {
        if (event.target !== dialog.current) return;
        const rect = dialog.current.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }}
      className="sheet mx-auto mb-2 mt-auto flex max-h-[90dvh] w-[calc(100%-1rem)] max-w-md flex-col overflow-hidden rounded-[2.25rem] border-0 bg-card p-0 text-ink shadow-float sm:m-auto sm:w-[calc(100%-2rem)]"
    >
      <div className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing" data-sheet-grip="">
        <div aria-hidden="true" className="mx-auto mt-2.5 h-[5px] w-9 rounded-full bg-ink/15" />
        {list && list.length > 1 && (
          <div className="mt-1 flex items-center justify-center gap-0.5 text-[12px] font-medium tabular-nums text-subtle">
            <button type="button" aria-label="Previous filing" onClick={() => page(-1)} disabled={!can(-1)} className="press-sm flex h-8 !min-h-8 w-8 items-center justify-center rounded-full disabled:!opacity-30">
              <Icon name="chevronLeft" className="h-4 w-4" />
            </button>
            <span aria-live="polite">
              {index + 1} of {list.length}
            </span>
            <button type="button" aria-label="Next filing" onClick={() => page(1)} disabled={!can(1)} className="press-sm flex h-8 !min-h-8 w-8 items-center justify-center rounded-full disabled:!opacity-30">
              <Icon name="chevronRight" className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className={`flex flex-col items-center px-6 pb-2 text-center ${list && list.length > 1 ? "pt-2" : "pt-5"}`}>
          <div className="relative">
            <CompanyLogo ticker={r.ticker} company={company} size={56} rounded="rounded-[16px]" />
            <div className="absolute -bottom-2 -right-3 flex">
              <Avatar name={r.entityName} src={r.entityPhoto} kind={auraOf(r.entityType)} size={30} className="face-lift ring-2 ring-card" />
            </div>
          </div>
          <h2 id={titleId} className="mt-4 max-w-full font-display text-[21px] font-bold leading-snug tracking-[-0.01em]">
            {actor} <span className={tone === "neutral" ? "font-semibold text-subtle" : TONE[tone]}>{verb}</span> {company}
          </h2>
          <p className="mt-1 text-[14px] text-subtle">
            {KIND[r.entityType]} · {quarter ? `13F for ${quarter}` : formatDate(r.disclosedAt)}
          </p>
        </div>
        <button type="button" onClick={close} className="sr-only focus:not-sr-only">Close</button>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pb-1 pt-3">
          {error ? (
            <div role="alert" className="rounded-2xl bg-surface2 p-4 text-sm">
              Price data is unavailable right now.{" "}
              <button type="button" onClick={() => setRetry((n) => n + 1)} className="font-medium underline">
                Try again
              </button>
            </div>
          ) : !data && r.ticker ? (
            <SkeletonChart height={190} />
          ) : bars.length > 1 ? (
            <>
              <PriceChart key={r.ticker ?? ""} bars={bars} height={160} size="md" markDate={r.disclosedAt} markLabel="Disclosed" />
              {(stale || data?.source === "sample") && (
                <p className="mt-2 text-xs text-subtle">
                  {stale ? `Prices out of date (${formatDate(last.date)})` : ""}
                  {data?.source === "sample" ? " · sample data" : ""}
                </p>
              )}
            </>
          ) : (
            <p className="rounded-2xl bg-surface2 p-4 text-sm text-subtle">No price history is available for this filing.</p>
          )}
        </div>

        <dl className="mx-5 mt-2">
          {facts.map(([label, value]) => (
            <div key={label} className="flex min-h-[2.9rem] items-center justify-between gap-4 border-b border-hair py-2 text-[15px] last:border-0">
              <dt className="text-subtle">{label}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {r.entityType === "institution" && <p className="mx-5 mt-3 rounded-xl bg-surface2 p-3 text-xs leading-5 text-ink/80">A comparison of quarterly holdings. The report doesn’t reveal the trade date or execution price.</p>}
        {r.entityType === "corporate_insider" && !r.transactionCode && <p className="mx-5 mt-3 rounded-xl bg-warn/10 p-3 text-xs leading-5 text-warn">This older record lacks the original transaction code, so it can’t be confirmed as a real buy or sell.</p>}
        <p className="px-5 pb-4 pt-3 text-xs leading-5 text-subtle">
          Closing prices in USD. The price change is not the filer’s return. Missing or stale prices are never replaced with estimates.{" "}
          <Link href="/methodik" onClick={onClose} className="underline">
            Methodology
          </Link>
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 border-t border-hair p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {profile && (
          <Link onClick={onClose} href={profile} className="btn-capsule min-h-11 flex-1">
            <Icon name="user" className="h-4 w-4" />
            Profile
          </Link>
        )}
        {r.ticker && (
          <Link onClick={onClose} href={stockHref(r.ticker)} className="btn-primary min-h-11 flex-1">
            <Icon name="chart" className="h-4 w-4" />
            View stock
          </Link>
        )}
        {source ? (
          <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 px-3 text-sm font-medium text-subtle underline underline-offset-2 hover:text-ink">
            <Icon name="document" className="h-4 w-4" />
            Open original filing
          </a>
        ) : (
          <span className="w-full p-3 text-center text-xs text-subtle">Source link missing</span>
        )}
      </div>
    </dialog>
  );
}
