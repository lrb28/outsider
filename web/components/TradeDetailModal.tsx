"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { auraOf, companyName, formatDate, isStaleDate, pct, sourceLink, stockHref, tradeSignal } from "@/lib/format";
import { fetchJson } from "@/lib/fetchJson";
import { useDragDismiss, useScrollLock } from "@/lib/sheetGestures";
import type { FeedRow, PricesResponse } from "@/lib/types";

import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";
import { Icon } from "./Icon";
import { PriceChart } from "./PriceChart";
import { SkeletonChart } from "./Skeleton";

const price = (v: number | null) => (v !== null && Number.isFinite(v) ? v.toLocaleString("de-DE", { style: "currency", currency: "USD" }) : "—");

/**
 * One disclosure in detail, as a card that rises from the bottom. The price
 * chart is the same interactive one as on the stock page (drag to read any
 * day; the disclosure is marked). Swipe down, tap outside or Escape closes
 * it; the page behind stays put.
 */
export function TradeDetailModal({ row, onClose }: { row: FeedRow; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [data, setData] = useState<PricesResponse | null>(null);
  const [error, setError] = useState(false);
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

  useScrollLock();
  useDragDismiss(dialog, scroller, () => closeRef.current());

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

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(false);
    if (row.ticker)
      fetchJson<PricesResponse>(`/api/prices?ticker=${encodeURIComponent(row.ticker)}`, { signal: controller.signal })
        .then(setData)
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        });
    return () => controller.abort();
  }, [row.ticker, retry]);

  const sig = tradeSignal(row);
  const company = companyName(row.ticker, row.securityName);
  const bars = data?.bars ?? [];
  const last = bars[bars.length - 1];
  const stale = isStaleDate(last?.date ?? null);
  const cutoff = row.disclosedAt ? new Date(Date.parse(row.disclosedAt) + 7 * 86400000).toISOString().slice(0, 10) : null;
  const entry = row.disclosedAt ? bars.find((bar) => bar.date >= row.disclosedAt! && bar.date <= cutoff!)?.close ?? null : null;
  const perf = !last || entry === null || entry <= 0 || stale ? null : (last.close - entry) / entry;
  const profile = row.entitySlug ? `/${row.entityType === "institution" ? "investor" : row.entityType === "politician" ? "politician" : "insider"}/${row.entitySlug}` : null;
  const source = sourceLink(row.sourceUrl);

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
      onClick={(event) => {
        if (event.target !== dialog.current) return;
        const rect = dialog.current.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }}
      className="sheet mx-auto mb-2 mt-auto flex max-h-[90dvh] w-[calc(100%-1rem)] max-w-md flex-col overflow-hidden rounded-[2.25rem] border-0 bg-card p-0 text-ink shadow-float sm:m-auto sm:w-[calc(100%-2rem)]"
    >
      <div className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing" data-sheet-grip="">
        <div aria-hidden="true" className="mx-auto mt-2.5 h-[5px] w-9 rounded-full bg-ink/15" />
        <div className="flex items-start gap-3 p-5 pb-3">
          <div className="relative shrink-0">
            <CompanyLogo ticker={row.ticker} company={company} size={48} />
            <div className="absolute -bottom-1.5 -right-1.5 flex">
              <Avatar name={row.entityName} src={row.entityPhoto} kind={auraOf(row.entityType)} size={26} className="face-lift" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate font-display text-[22px] font-bold leading-tight tracking-[-0.01em]">{company}</h2>
            <p className="mt-1 truncate text-sm text-subtle">{row.entityName}</p>
          </div>
        </div>
        <button type="button" onClick={close} className="sr-only focus:not-sr-only">Close</button>
        <div className="flex flex-wrap items-center gap-2 px-5">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${sig.tone === "bull" ? "bg-bull/10 text-bull" : sig.tone === "bear" ? "bg-bear/10 text-bear" : "bg-surface2 text-subtle"}`}>{sig.text}</span>
          {perf !== null && (
            <span className={`text-xs font-semibold tabular-nums ${perf >= 0 ? "text-bull" : "text-bear"}`}>
              {perf >= 0 ? "▲" : "▼"} {pct(perf)} seit Offenlegung
            </span>
          )}
          {row.transactionCode && <span className="text-xs text-subtle">Form-4-Code {row.transactionCode}</span>}
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pb-2 pt-4">
          {error ? (
            <div role="alert" className="rounded-2xl bg-surface2 p-4 text-sm">
              Kursdaten sind gerade nicht verfügbar.{" "}
              <button type="button" onClick={() => setRetry((r) => r + 1)} className="font-medium underline">
                Erneut versuchen
              </button>
            </div>
          ) : !data && row.ticker ? (
            <SkeletonChart height={190} />
          ) : bars.length > 1 ? (
            <>
              <PriceChart bars={bars} height={170} size="md" markDate={row.disclosedAt} markLabel="Offengelegt" />
              <p className="mt-2 text-xs text-subtle">
                Schlusskurse in USD{stale ? ` · veraltet (${formatDate(last.date)})` : ""}
                {data?.source === "sample" ? " · Beispieldaten" : ""}
              </p>
            </>
          ) : (
            <p className="rounded-2xl bg-surface2 p-4 text-sm text-subtle">Für diese Meldung ist kein Kursverlauf verfügbar.</p>
          )}
        </div>
        {row.entityType === "institution" && <p className="mx-5 mt-2 rounded-xl bg-surface2 p-3 text-xs leading-5 text-ink/80">Vergleich von Quartalsbeständen. Handelstag und Ausführungskurs sind aus dem Bericht nicht ableitbar.</p>}
        {row.entityType === "corporate_insider" && !row.transactionCode && <p className="mx-5 mt-2 rounded-xl bg-warn/10 p-3 text-xs leading-5 text-warn">Der Originalcode fehlt in diesem älteren Datensatz. Eine Einordnung als echter Kauf oder Verkauf ist deshalb nicht gesichert.</p>}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 text-sm">
          <Stat label="Gemeldete Größe" value={row.sizeDisplay} />
          <Stat label={row.entityType === "institution" ? "Berichtsstichtag" : "Gemeldeter Handelstag"} value={formatDate(row.entityType === "institution" ? row.reportingDate ?? row.txnDate : row.txnDate)} />
          <Stat label="Offengelegt am" value={formatDate(row.disclosedAt)} />
          <Stat label="Kursstand" value={formatDate(last?.date ?? null)} />
          <Stat label="Schlusskurs nach Offenlegung" value={price(entry)} />
          <Stat label="Letzter verfügbarer Schlusskurs" value={price(last?.close ?? null)} />
          <Stat label="Kursänderung seit Offenlegung" value={pct(perf)} />
        </dl>
        <p className="px-5 pb-4 text-xs leading-5 text-subtle">
          Die Kursänderung ist keine Rendite des Akteurs. Fehlende oder veraltete Kursdaten werden nicht durch Schätzwerte ersetzt.{" "}
          <Link href="/methodik" onClick={onClose} className="underline">
            Methodik
          </Link>
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 border-t border-hair p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {profile && (
          <Link onClick={onClose} href={profile} className="btn-capsule min-h-11 flex-1">
            <Icon name="user" className="h-4 w-4" />
            Akteur
          </Link>
        )}
        {row.ticker && (
          <Link onClick={onClose} href={stockHref(row.ticker)} className="btn-primary min-h-11 flex-1">
            <Icon name="chart" className="h-4 w-4" />
            Aktie ansehen
          </Link>
        )}
        {source ? (
          <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 px-3 text-sm font-medium text-subtle underline underline-offset-2 hover:text-ink">
            <Icon name="document" className="h-4 w-4" />
            Originalmeldung öffnen
          </a>
        ) : (
          <span className="w-full p-3 text-center text-xs text-subtle">Quellenlink fehlt</span>
        )}
      </div>
    </dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
