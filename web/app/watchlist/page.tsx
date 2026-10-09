"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type CSSProperties, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ErrorRetry } from "@/components/ErrorRetry";
import { Icon } from "@/components/Icon";
import { loadInvestor } from "@/components/InvestorView";
import { loadPolitician } from "@/components/PoliticianView";
import { Skeleton, SkeletonList } from "@/components/Skeleton";
import { EmptyState, PageTitle, politicianLine, SegmentedControl } from "@/components/ui";
import { WatchPager } from "@/components/WatchPager";
import { fetchCatalogue } from "@/lib/fetchJson";
import { fixTicker, shortFund, stockHref } from "@/lib/format";
import type { InvestorRow, InvestorsResponse, PoliticianRow, PoliticiansResponse, StockRow, StocksResponse } from "@/lib/types";
import { type FollowKind, getFollowed, personFromWho, toggleFollow, watchedPeople, type WatchedPerson } from "@/lib/watchlist";

/*
 * The star tab (user, 2026-10-09; it took the Portfolio's place): everything
 * you follow, as a list or as the swipe view. The choice is a segmented
 * control under the title and is remembered on this device, with the person
 * you were at, so the tab opens the way you left it.
 *
 * List: people (investors, then politicians) and stocks in grouped rows,
 * each with a star to unfollow. An unstarred row stays, hollow, until you
 * come back, so a slip of the thumb is undone with a second tap. A person's
 * row opens the swipe view at them; a stock's row opens the stock.
 *
 * Swipe: `WatchPager`. A tap on the band of names closes it, back to the
 * list, as does tapping the star tab again. Both ways the picture flies
 * between the row and the page (View Transitions where the browser has
 * them; elsewhere the views fade).
 */

type View = "list" | "swipe";
type Follows = Record<FollowKind, string[]>;
const VIEW = "outsider:watch-view";
const LAST = "outsider:watch-last";
const VIEWS = [
  ["list", "List"],
  ["swipe", "Swipe"],
] as const;

const keyOf = (p: { kind: string; slug: string }) => `${p.kind}/${p.slug}`;
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: not remembered */
  }
}

type Transition = { finished: Promise<void>; ready: Promise<void> };
/**
 * Runs `update` inside a view transition where there is one, else plainly.
 * Resolves when the motion is over. A transition the browser skips (a
 * hidden tab) still runs `update`; its rejected promises are expected.
 */
function morph(update: () => void): Promise<void> | null {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => Transition };
  if (!doc.startViewTransition || reducedMotion()) {
    update();
    return null;
  }
  const t = doc.startViewTransition(() => flushSync(update));
  t.ready.catch(() => {});
  return t.finished.catch(() => {});
}

function prefetch(p: { kind: WatchedPerson["kind"]; slug: string }) {
  (p.kind === "investor" ? loadInvestor(p.slug) : loadPolitician(p.slug)).catch(() => {});
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
  const [view, setView] = useState<View>("list");
  // The swipe view's person (`kind/slug`), and the one whose picture flies.
  const [at, setAt] = useState<string | null>(null);
  const [flying, setFlying] = useState<string | null>(null);
  // Who the swipe view shows right now (it turns without telling React).
  const shownNow = useRef<string | null>(null);
  const [plainIn, setPlainIn] = useState(false);
  // The rows rise in one after another only on arrival, not on the way back
  // from the swipe view (the picture flies home then).
  const [fresh, setFresh] = useState(true);
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

  // The swipe view goes through the people you follow now; the list also
  // keeps the ones unstarred on this visit.
  const people = useMemo(() => (cat && follow ? watchedPeople(cat.investors, cat.politicians, follow) : []), [cat, follow]);
  const listed = useMemo(() => (cat ? watchedPeople(cat.investors, cat.politicians, shown) : []), [cat, shown]);
  const stocks = useMemo(() => {
    if (!cat) return [];
    // One row per company: Alphabet's two share classes would be two rows.
    const rows = cat.stocks.filter((s) => s.ticker && shown.stock.includes(s.ticker)).sort((a, b) => b.investors - a.investors);
    return rows.filter((s, i) => rows.findIndex((o) => o.company === s.company) === i).sort((a, b) => shown.stock.indexOf(a.ticker!) - shown.stock.indexOf(b.ticker!));
  }, [cat, shown.stock]);
  const invById = useMemo(() => new Map((cat?.investors ?? []).map((i) => [i.slug, i])), [cat]);
  const polById = useMemo(() => new Map((cat?.politicians ?? []).map((p) => [p.slug, p])), [cat]);

  const setUrl = (url: string) => {
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  };

  /** Into the swipe view at `key` (or where you were, or the first person). */
  const open = useCallback(
    (key?: string | null) => {
      if (!people.length) return;
      const target = people.find((p) => keyOf(p) === key) ?? people.find((p) => keyOf(p) === stored(LAST)) ?? people[0];
      const k = keyOf(target);
      prefetch(target);
      store(VIEW, "swipe");
      setFresh(false);
      // The row's picture is named first, so the transition sees it go.
      flushSync(() => setFlying(k));
      const t = morph(() => {
        setView("swipe");
        setAt(k);
        setPlainIn(false);
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      if (!t) setPlainIn(true);
      t?.then(() => setFlying(null));
    },
    [people],
  );

  /** Back to the list, the picture flying home to its row. */
  const close = useCallback(() => {
    store(VIEW, "list");
    const k = shownNow.current ?? at;
    const t = morph(() => {
      setView("list");
      setFlying(k);
      setPlainIn(false);
      window.scrollTo({ top: 0, behavior: "instant" });
      const row = k ? document.querySelector<HTMLElement>(`[data-row="${CSS.escape(k)}"]`) : null;
      if (row && row.getBoundingClientRect().bottom > window.innerHeight - 120) row.scrollIntoView({ block: "center", behavior: "instant" });
    });
    if (!t) {
      setPlainIn(true);
      setFlying(null);
    }
    t?.then(() => setFlying(null));
    setUrl("/watchlist");
  }, [at]);

  // Arrival: `?who=` opens that person, otherwise the view you left.
  useEffect(() => {
    if (started.current || !cat || !follow) return;
    started.current = true;
    const who = personFromWho(params.get("who"));
    const want = who || params.get("view") === "swipe" || stored(VIEW) === "swipe";
    if (want && people.length) {
      const target = (who && people.find((p) => keyOf(p) === keyOf(who))) || people.find((p) => keyOf(p) === stored(LAST)) || people[0];
      prefetch(target);
      setAt(keyOf(target));
      setView("swipe");
      setPlainIn(true);
    }
  }, [cat, follow, people, params]);

  // Tapping the star tab again from the swipe view goes back to the list.
  useEffect(() => {
    const again = (e: Event) => {
      if ((e as CustomEvent<string>).detail === "/watchlist" && view === "swipe") close();
    };
    window.addEventListener("outsider:tab-again", again);
    return () => window.removeEventListener("outsider:tab-again", again);
  }, [view, close]);

  const onTurn = useCallback((p: WatchedPerson) => {
    shownNow.current = keyOf(p);
    store(LAST, keyOf(p));
    setUrl(`/watchlist?who=${keyOf(p)}`);
  }, []);

  const unfollow = (kind: FollowKind, id: string) => {
    try {
      toggleFollow(kind, id);
    } catch {
      /* StorageNotice reports the failed write. */
    }
  };

  if (view === "swipe" && at && people.length) {
    const start = Math.max(0, people.findIndex((p) => keyOf(p) === at));
    return (
      <div className={plainIn ? "pager-in" : undefined}>
        <WatchPager people={people} start={start} onClose={close} onTurn={onTurn} />
      </div>
    );
  }

  const loading = follow === null || (any && !cat && !failed);
  const empty = follow !== null && !any && listed.length === 0 && stocks.length === 0;

  return (
    <div className={`space-y-6 ${plainIn ? "list-in" : ""} ${fresh ? "watch-rows-in" : ""}`}>
      <PageTitle title="Watchlist">
        {people.length > 0 && <SegmentedControl label="View" options={VIEWS} value={view} onChange={(v) => v === "swipe" && open()} />}
      </PageTitle>

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

      {!loading && listed.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="px-4 text-[13px] font-medium text-subtle">People</h2>
          <div className="card overflow-hidden">
            {listed.map((p, i) => {
              const k = keyOf(p);
              const on = follow![p.kind].includes(p.slug);
              const inv = p.kind === "investor" ? invById.get(p.slug) : undefined;
              const pol = p.kind === "politician" ? polById.get(p.slug) : undefined;
              const line = inv ? `Investor${inv.person ? ` · ${shortFund(inv.fund)}` : " · 13F"}` : `Politician · ${politicianLine(pol?.party, pol?.seat)}`;
              return (
                <div key={k} data-row={k} className="watch-row relative flex items-center pr-2 after:absolute after:bottom-0 after:left-[4.6rem] after:right-0 after:h-px after:bg-hair last:after:hidden" style={{ "--i": i } as CSSProperties}>
                  <button
                    type="button"
                    onPointerDown={() => prefetch(p)}
                    onClick={() => on && open(k)}
                    aria-disabled={!on}
                    aria-label={on ? `${p.name}, open in the swipe view` : `${p.name} (unfollowed)`}
                    className={`flex min-h-[4.25rem] min-w-0 flex-1 items-center gap-3.5 py-2.5 pl-4 pr-2 text-left transition-[background-color,opacity] duration-300 ${on ? "hover:bg-ink/[0.03] active:bg-ink/[0.06]" : "cursor-default opacity-[0.45]"}`}
                  >
                    <span data-face className="flex rounded-full" style={flying === k ? { viewTransitionName: "watch-face" } as CSSProperties : undefined}>
                      <Avatar name={p.name} src={p.photo} kind={p.kind} size={44} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold leading-tight">{p.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-subtle">
                        <i aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: `rgb(var(--aura-${p.kind}))` }} />
                        <span className="truncate">{line}</span>
                      </span>
                    </span>
                  </button>
                  <Star on={on} label={p.name} onToggle={() => unfollow(p.kind, p.slug)} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!loading && stocks.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="px-4 text-[13px] font-medium text-subtle">Stocks</h2>
          <div className="card overflow-hidden">
            {stocks.map((s, i) => {
              const on = follow!.stock.includes(s.ticker!);
              return (
                <div key={s.ticker} className="watch-row relative flex items-center pr-2 after:absolute after:bottom-0 after:left-[4.6rem] after:right-0 after:h-px after:bg-hair last:after:hidden" style={{ "--i": listed.length + i } as CSSProperties}>
                  <Link href={stockHref(s.ticker!)} className={`flex min-h-[4.25rem] min-w-0 flex-1 items-center gap-3.5 py-2.5 pl-4 pr-2 transition-[background-color,opacity] duration-300 hover:bg-ink/[0.03] active:bg-ink/[0.06] ${on ? "" : "opacity-[0.45]"}`}>
                    <CompanyLogo ticker={s.ticker} company={s.company} size={44} rounded="rounded-[13px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold leading-tight">{s.company}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-subtle">
                        {fixTicker(s.ticker, s.company) ?? s.ticker} · {s.investors} {s.investors === 1 ? "investor" : "investors"}
                      </span>
                    </span>
                  </Link>
                  <Star on={on} label={s.company} onToggle={() => unfollow("stock", s.ticker!)} />
                </div>
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
    </div>
  );
}
