"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type CSSProperties, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ErrorRetry } from "@/components/ErrorRetry";
import { Icon } from "@/components/Icon";
import { loadInvestor } from "@/components/InvestorView";
import { loadPolitician } from "@/components/PoliticianView";
import { Skeleton, SkeletonList } from "@/components/Skeleton";
import { loadStock } from "@/components/StockView";
import { EmptyState, PageTitle, politicianLine } from "@/components/ui";
import { WatchSheet } from "@/components/WatchSheet";
import { fetchCatalogue } from "@/lib/fetchJson";
import { fixTicker, shortFund } from "@/lib/format";
import type { InvestorRow, InvestorsResponse, PoliticianRow, PoliticiansResponse, StockRow, StocksResponse } from "@/lib/types";
import { entryFromWho, type FollowKind, getFollowed, toggleFollow, type WatchEntry, watchedPeople, watchedStocks } from "@/lib/watchlist";

/*
 * The star tab (user, 2026-10-09; it took the Portfolio's place): everything
 * you follow, people (investors, then politicians) and stocks, in grouped
 * rows, each with a star to unfollow. An unstarred row stays, hollow, until
 * you come back, so a slip of the thumb is undone with a second tap.
 *
 * A row opens the swipe view right there (`WatchSheet`): the people's
 * pages, or the stocks' pages, one at a time, swiping sideways to the next.
 * It grows out of the row and goes back into it: tap the band of names, pull
 * the page down, or tap the star tab again. The URL follows the page shown
 * (`?who=investor/…`, `?who=stock/NVDA`), so a reload or a shared link opens
 * it again.
 */

type Follows = Record<FollowKind, string[]>;
type Open = { start: number; from: string | null };

const keyOf = (p: { kind: string; slug: string }) => `${p.kind}/${p.slug}`;

function prefetch(p: { kind: WatchEntry["kind"]; slug: string }) {
  (p.kind === "investor" ? loadInvestor(p.slug) : p.kind === "politician" ? loadPolitician(p.slug) : loadStock(p.slug)).catch(() => {});
}

function Star({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? `Unfollow ${label}` : `Follow ${label} again`}
      className={`press-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${on ? "text-ink" : "text-muted"}`}
    >
      <Icon key={on ? "on" : "off"} name={on ? "starFill" : "star"} className={`h-[22px] w-[22px] ${on ? "tab-pop" : ""}`} />
    </button>
  );
}

/** One row: the face (picture or logo), two lines, the star. Tapping it opens the swipe view. */
function Row({ entry, i, on, away, face, line, onOpen, onToggle }: { entry: WatchEntry; i: number; on: boolean; away: boolean; face: ReactNode; line: ReactNode; onOpen: () => void; onToggle: () => void }) {
  return (
    <div data-row={keyOf(entry)} className="watch-row relative flex items-center pr-2 after:absolute after:bottom-0 after:left-[4.6rem] after:right-0 after:h-px after:bg-hair last:after:hidden" style={{ "--i": i } as CSSProperties}>
      <button
        type="button"
        onPointerDown={() => on && prefetch(entry)}
        onClick={() => on && onOpen()}
        aria-disabled={!on}
        aria-label={on ? `${entry.name}, open` : `${entry.name} (unfollowed)`}
        className={`flex min-h-[4.25rem] min-w-0 flex-1 items-center gap-3.5 py-2.5 pl-4 pr-2 text-left transition-[background-color,opacity] duration-300 ${on ? "hover:bg-ink/[0.03] active:bg-ink/[0.06]" : "cursor-default opacity-[0.45]"}`}
      >
        {/* While its page is up in the swipe view, the row shows no picture. */}
        <span data-face className="flex" style={away ? { visibility: "hidden" } : undefined}>
          {face}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold leading-tight">{entry.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-subtle">{line}</span>
        </span>
      </button>
      <Star on={on} label={entry.name} onToggle={onToggle} />
    </div>
  );
}

export default function WatchlistPage() {
  return (
    <Suspense fallback={<SkeletonList n={5} />}>
      <Watchlist />
    </Suspense>
  );
}

function Watchlist() {
  const params = useSearchParams();
  const [follow, setFollow] = useState<Follows | null>(null);
  // Everything followed since the page opened: unstarred rows stay, hollow.
  const [shown, setShown] = useState<Follows>({ investor: [], politician: [], stock: [] });
  const [cat, setCat] = useState<{ investors: InvestorRow[]; politicians: PoliticianRow[]; stocks: StockRow[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState<Open | null>(null);
  // The pages the swipe view goes through, as they were when it opened.
  const ring = useRef<WatchEntry[]>([]);
  // The row whose page is up in the swipe view.
  const [away, setAway] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const sync = () => {
      const now: Follows = { investor: getFollowed("investor"), politician: getFollowed("politician"), stock: getFollowed("stock") };
      setFollow(now);
      setShown((s) => ({
        investor: [...new Set([...s.investor, ...now.investor])],
        politician: [...new Set([...s.politician, ...now.politician])],
        stock: [...new Set([...s.stock, ...now.stock])],
      }));
    };
    sync();
    window.addEventListener("watchlist", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("watchlist", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const any = !!follow && follow.investor.length + follow.politician.length + follow.stock.length > 0;
  useEffect(() => {
    if (!any) return;
    setFailed(false);
    Promise.all([
      fetchCatalogue<InvestorsResponse>("/api/investors"),
      fetchCatalogue<PoliticiansResponse>("/api/politicians").catch(() => ({ rows: [] as PoliticianRow[] })),
      fetchCatalogue<StocksResponse>("/api/stocks").catch(() => ({ rows: [] as StockRow[] })),
    ])
      .then(([iv, po, st]) => setCat({ investors: iv.rows, politicians: po.rows, stocks: st.rows }))
      .catch(() => setFailed(true));
  }, [any, retry]);

  // The swipe view goes through what you follow now; the list also keeps
  // what was unstarred on this visit.
  const people = useMemo(() => (cat && follow ? watchedPeople(cat.investors, cat.politicians, follow) : []), [cat, follow]);
  const stocks = useMemo(() => (cat && follow ? watchedStocks(cat.stocks, follow.stock) : []), [cat, follow]);
  const listedPeople = useMemo(() => (cat ? watchedPeople(cat.investors, cat.politicians, shown) : []), [cat, shown]);
  const listedStocks = useMemo(() => (cat ? watchedStocks(cat.stocks, shown.stock) : []), [cat, shown.stock]);
  const invById = useMemo(() => new Map((cat?.investors ?? []).map((i) => [i.slug, i])), [cat]);
  const polById = useMemo(() => new Map((cat?.politicians ?? []).map((p) => [p.slug, p])), [cat]);
  const stockById = useMemo(() => new Map((cat?.stocks ?? []).filter((s) => s.ticker).map((s) => [s.ticker!, s])), [cat]);

  const setUrl = (url: string) => {
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  };

  /** Opens the swipe view at `key`, among the people or among the stocks; `from` is the row it grows out of. */
  const openAt = (key: string, from: string | null) => {
    const list = key.startsWith("stock/") ? stocks : people;
    const start = list.findIndex((e) => keyOf(e) === key);
    if (start < 0) return false;
    prefetch(list[start]);
    ring.current = list;
    setOpen({ start, from });
    return true;
  };

  // Arrival: `?who=` opens that page.
  useEffect(() => {
    if (started.current || !cat || !follow) return;
    started.current = true;
    const who = entryFromWho(params.get("who"));
    if (who && !openAt(keyOf(who), null)) setUrl("/watchlist");
    // `openAt` reads `people` and `stocks`, which are ready with `cat`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, follow, params]);

  const onTurn = useCallback((e: WatchEntry) => {
    setAway(keyOf(e));
    setUrl(`/watchlist?who=${keyOf(e)}`);
  }, []);
  const onClosed = useCallback(() => {
    setOpen(null);
    setAway(null);
    setUrl("/watchlist");
  }, []);

  const unfollow = (kind: FollowKind, id: string) => {
    try {
      toggleFollow(kind, id);
    } catch {
      /* StorageNotice reports the failed write. */
    }
  };

  const loading = follow === null || (any && !cat && !failed);
  const empty = follow !== null && !any && listedPeople.length === 0 && listedStocks.length === 0;

  return (
    // The rows rise in once, when they arrive; the list stays put under the
    // swipe view, so coming back never replays it.
    <div className="watch-rows-in space-y-6">
      <PageTitle title="Watchlist" />

      {failed && <ErrorRetry onRetry={() => setRetry((r) => r + 1)} />}

      {loading && !failed && (
        <div className="space-y-2">
          <Skeleton className="ml-4 h-3.5 w-16" />
          <SkeletonList n={4} />
        </div>
      )}

      {empty && (
        <EmptyState icon="star" title="Nothing starred yet">
          Follow investors, politicians and stocks, and they gather here.
          <div className="mt-4">
            <Link href="/?welcome=folgen" className="btn-primary">Choose who to follow</Link>
          </div>
        </EmptyState>
      )}

      {!loading && listedPeople.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="px-4 text-[13px] font-medium text-subtle">People</h2>
          <div className="card overflow-hidden">
            {listedPeople.map((p, i) => {
              const k = keyOf(p);
              const kind = p.kind === "politician" ? "politician" : "investor";
              const inv = kind === "investor" ? invById.get(p.slug) : undefined;
              const pol = kind === "politician" ? polById.get(p.slug) : undefined;
              return (
                <Row
                  key={k}
                  entry={p}
                  i={i}
                  on={follow![kind].includes(p.slug)}
                  away={away === k}
                  face={<Avatar name={p.name} src={p.photo} kind={kind} size={44} />}
                  line={
                    <>
                      <i aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: `rgb(var(--aura-${kind}))` }} />
                      <span className="truncate">{inv ? `Investor${inv.person ? ` · ${shortFund(inv.fund)}` : " · 13F"}` : `Politician · ${politicianLine(pol?.party, pol?.seat)}`}</span>
                    </>
                  }
                  onOpen={() => openAt(k, k)}
                  onToggle={() => unfollow(kind, p.slug)}
                />
              );
            })}
          </div>
        </section>
      )}

      {!loading && listedStocks.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="px-4 text-[13px] font-medium text-subtle">Stocks</h2>
          <div className="card overflow-hidden">
            {listedStocks.map((s, i) => {
              const k = keyOf(s);
              const row = stockById.get(s.slug);
              return (
                <Row
                  key={k}
                  entry={s}
                  i={listedPeople.length + i}
                  on={follow!.stock.includes(s.slug)}
                  away={away === k}
                  face={<CompanyLogo ticker={s.slug} company={s.name} size={44} rounded="rounded-[13px]" />}
                  line={
                    <span className="truncate">
                      {fixTicker(s.slug, s.name) ?? s.slug}
                      {row ? ` · ${row.investors} ${row.investors === 1 ? "investor" : "investors"}` : ""}
                    </span>
                  }
                  onOpen={() => openAt(k, k)}
                  onToggle={() => unfollow("stock", s.slug)}
                />
              );
            })}
          </div>
        </section>
      )}

      {!loading && !empty && (
        <div className="flex justify-center pt-1">
          <Link href="/?welcome=folgen" className="btn-capsule">
            <Icon name="plus" className="h-[18px] w-[18px]" />
            Follow more
          </Link>
        </div>
      )}

      {open && <WatchSheet key={`${keyOf(ring.current[open.start])}`} entries={ring.current} start={open.start} from={open.from} onTurn={onTurn} onClosed={onClosed} />}
    </div>
  );
}
