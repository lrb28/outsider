"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Icon } from "@/components/Icon";
import { fetchCatalogue } from "@/lib/fetchJson";
import { stockHref } from "@/lib/format";
import type { InvestorsResponse, PoliticiansResponse, StocksResponse } from "@/lib/types";

type Hit = { name: string; keywords: string; href: string; kind: string; ticker?: string; photo?: string | null };

// Recently opened results (after Eaves), kept on this device only.
const RECENT = "aura:recent-searches";
function readRecent(): Hit[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT) || "[]");
    return Array.isArray(v) ? v.filter((h): h is Hit => !!h && typeof h.href === "string" && typeof h.name === "string" && h.href.startsWith("/")).slice(0, 6) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: Hit[]) {
  try {
    localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* private mode: no history */
  }
}

function rank(items: Hit[], needle: string): Hit[] {
  const scored: { hit: Hit; score: number; i: number }[] = [];
  items.forEach((hit, i) => {
    const name = hit.name.toLocaleLowerCase("en-US");
    const keys = hit.keywords.toLocaleLowerCase("en-US");
    if (!keys.includes(needle)) return;
    const ticker = hit.ticker?.toLocaleLowerCase("en-US");
    const score = ticker === needle || name.startsWith(needle) ? 0 : ticker?.startsWith(needle) || name.split(/[\s.\-&]+/).some((w) => w.startsWith(needle)) ? 1 : keys.split(/[\s.\-&]+/).some((w) => w.startsWith(needle)) ? 2 : 3;
    scored.push({ hit, score, i });
  });
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((x) => x.hit);
}

/** The search over investors, stocks and politicians, shared by the header field and the phone's search. */
function useSearch(limit: number) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<Hit[]>([]);
  const loaded = useRef(false);
  const busy = useRef(false);

  const ensureData = useCallback(async () => {
    if (loaded.current || busy.current) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    const results = await Promise.allSettled([
      fetchCatalogue<InvestorsResponse>("/api/investors").then((d) => d.rows.map((r) => ({ name: r.person ?? r.fund, keywords: `${r.person} ${r.fund}`, href: `/investor/${r.slug}`, kind: "Investor" }))),
      fetchCatalogue<StocksResponse>("/api/stocks").then((d) => d.rows.filter((r) => r.ticker).map((r) => ({ name: r.company, keywords: `${r.company} ${r.ticker}`, href: stockHref(r.ticker!), kind: r.ticker!, ticker: r.ticker! }))),
      fetchCatalogue<PoliticiansResponse>("/api/politicians").then((d) => d.rows.map((r) => ({ name: r.name, keywords: `${r.name} ${r.seat ?? ""}`, href: `/politician/${r.slug}`, kind: "Politician", photo: r.photo }))),
    ]);
    setItems(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])));
    loaded.current = results.every((r) => r.status === "fulfilled");
    setFailed(!loaded.current);
    setLoading(false);
    busy.current = false;
  }, []);

  const needle = q.trim().toLocaleLowerCase("en-US");
  // With nothing typed, the list shows the recent searches instead. Typed,
  // what starts with it comes first ("nv": NVIDIA before Viking Global
  // Investors), then words that start with it, then the rest.
  const hits = needle ? rank(items, needle).slice(0, limit) : recent;
  const prepare = () => {
    void ensureData();
    setRecent(readRecent());
  };
  const remember = (hit: Hit) => {
    const next = [hit, ...readRecent().filter((h) => h.href !== hit.href)];
    writeRecent(next);
    setRecent(next.slice(0, 6));
  };
  const clearRecent = () => {
    writeRecent([]);
    setRecent([]);
    setActive(-1);
  };
  const reset = () => {
    setQ("");
    setActive(-1);
  };
  return { q, setQ, needle, hits, items, loading, failed, active, setActive, ensureData, prepare, remember, clearRecent, reset };
}
type Search = ReturnType<typeof useSearch>;

function HitFace({ hit, size }: { hit: Hit; size: number }) {
  return hit.ticker ? (
    <CompanyLogo ticker={hit.ticker} company={hit.name} size={size} rounded={size > 32 ? "rounded-[12px]" : "rounded-[9px]"} />
  ) : (
    <Avatar name={hit.name} src={hit.photo} kind={hit.kind === "Politician" ? "politician" : "investor"} size={size} />
  );
}

/** "Recent" with "Clear", the status lines, the hits and "All filings for …". */
function Results({ s, id, onPick, onAll, large = false }: { s: Search; id: string; onPick: (hit: Hit) => void; onAll: () => void; large?: boolean }) {
  const row = large ? "min-h-14 gap-3.5 px-3 py-2 text-[17px]" : "min-h-11 gap-3 px-3 py-2 text-[15px]";
  return (
    <>
      {!s.needle && s.hits.length > 0 && (
        <div className="flex items-center justify-between px-3 pb-1 pt-2">
          <span className={`${large ? "text-[15px]" : "text-[13px]"} font-semibold text-subtle`}>Recent</span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={s.clearRecent} className="press-sm !min-h-8 rounded-full px-2 text-[13px] font-medium text-subtle hover:text-ink">
            Clear
          </button>
        </div>
      )}
      {s.needle && s.loading && <p role="status" className="p-3 text-sm text-subtle">Loading search …</p>}
      {s.needle && s.failed && (
        <div role="status" className="p-3 text-sm text-warn">
          Part of the search is unavailable. <button onClick={() => void s.ensureData()} className="underline">Try again</button>
        </div>
      )}
      {s.needle && !s.loading && !s.failed && !s.hits.length && <p role="status" className="px-3 pb-1 pt-3 text-sm text-subtle">No investors, stocks or politicians for “{s.q.trim()}”.</p>}
      <ul id={`${id}-results`} role="listbox" aria-label="Search results">
        {s.hits.map((hit, index) => (
          <li key={hit.href} id={`${id}-${index}`} role="option" aria-selected={index === s.active} className={large ? "search-row" : undefined} style={large ? ({ "--i": Math.min(index, 10) } as CSSProperties) : undefined}>
            <Link
              href={hit.href}
              onClick={() => onPick(hit)}
              onMouseDown={(e) => e.preventDefault()}
              onPointerMove={() => s.setActive(index)}
              className={`flex items-center rounded-2xl text-ink active:bg-ink/[0.08] ${row} ${index === s.active ? "bg-ink/[0.06]" : ""}`}
            >
              <HitFace hit={hit} size={large ? 40 : 30} />
              <span className="min-w-0 flex-1 truncate font-medium">{hit.name}</span>
              <span className={`shrink-0 ${large ? "text-[13px]" : "text-xs"} text-subtle`}>{hit.kind}</span>
            </Link>
          </li>
        ))}
        {/* Insiders and every other ticker live in the disclosures. */}
        {s.needle && (
          <li role="option" aria-selected={false} className={large ? "search-row" : undefined} style={large ? ({ "--i": Math.min(s.hits.length, 10) } as CSSProperties) : undefined}>
            <Link href={`/feed?q=${encodeURIComponent(s.q.trim())}`} onClick={onAll} onMouseDown={(e) => e.preventDefault()} className={`flex items-center rounded-2xl text-ink active:bg-ink/[0.08] ${row}`}>
              <span className={`icon-ring ${large ? "h-10 w-10" : "h-[30px] w-[30px]"}`}>
                <Icon name="search" className="h-4 w-4 text-subtle" />
              </span>
              <span className="min-w-0 flex-1 truncate">All filings for “{s.q.trim()}”</span>
            </Link>
          </li>
        )}
      </ul>
    </>
  );
}

/** Header search (tablets and desktops): a round glass loupe that widens into a field. `openWidth`: its width once tapped. */
export function SearchBox({ openWidth = "w-48 sm:w-60" }: { openWidth?: string }) {
  const s = useSearch(10);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const id = useId();
  const path = usePathname();

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const visible = open && (!!s.needle || s.hits.length > 0);
  const reset = () => {
    setOpen(false);
    s.reset();
    input.current?.blur();
  };
  const choose = (hit: Hit) => {
    s.remember(hit);
    reset();
    router.push(hit.href);
  };
  // A result is a real link, so a tap navigates even if focus has already
  // moved away from the field; the new page then closes the list.
  useEffect(() => {
    setOpen(false);
    s.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Close only when focus really lands elsewhere (keyboard Tab). A tap on a
  // result blurs the field on iOS before the click arrives; closing then
  // removed the list under the finger and the tap hit nothing.
  return (
    <div
      ref={box}
      className="relative"
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && !e.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <label htmlFor={id} className="sr-only">Search stocks, investors and politicians</label>
      <Icon name="search" className="pointer-events-none absolute left-[13px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-ink/70" />
      <input
        ref={input}
        id={id}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={`${id}-results`}
        aria-activedescendant={visible && s.active >= 0 && s.hits[s.active] ? `${id}-${s.active}` : undefined}
        autoComplete="off"
        value={s.q}
        onFocus={() => {
          s.prepare();
          setOpen(true);
        }}
        onChange={(e) => {
          s.setQ(e.target.value);
          setOpen(true);
          s.setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            s.setActive(-1);
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            s.setActive((old) => (s.hits.length ? (old + (e.key === "ArrowDown" ? 1 : -1) + s.hits.length) % s.hits.length : -1));
          } else if (e.key === "Enter" && visible) {
            e.preventDefault();
            if (s.hits[s.active]) choose(s.hits[s.active]);
            else if (s.needle) {
              const term = s.q.trim();
              reset();
              router.push(`/feed?q=${encodeURIComponent(term)}`);
            }
          }
        }}
        className={`search-capsule h-11 rounded-full text-[15px] text-ink outline-none transition-[width] duration-300 ease-spring ${open || s.q ? `${openWidth} cursor-text !pl-10 pr-3` : "w-11 cursor-pointer !px-0 text-transparent"}`}
      />
      {visible && (
        <div className="glass absolute right-0 z-40 mt-2 max-h-[65dvh] w-[min(22rem,calc(100vw-2rem))] overflow-auto rounded-3xl p-2">
          <Results
            s={s}
            id={id}
            onPick={(hit) => {
              s.remember(hit);
              reset();
            }}
            onAll={reset}
          />
          <p className="px-3 pt-2 text-[11px] text-subtle">↑ ↓ select · Enter open · Esc close</p>
        </div>
      )}
    </div>
  );
}

/**
 * Search on phones, behind the round loupe beside the tab bar (user,
 * 2026-10-09: the loupe instead of the "+"). The page goes soft behind
 * frosted glass, the field drops in at the top with the keyboard up and the
 * results rise row by row; "Cancel", Escape, a tap on the empty glass or
 * any navigation closes it. With nothing typed it shows the recent searches,
 * or a few people and stocks to start from.
 *
 * It stays mounted (inert while closed) so the loupe can focus the field in
 * the same tap: iOS only raises the keyboard for a focus inside the gesture.
 */
export function useSearchSheet() {
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  return { open, setOpen, field };
}

export function SearchSheet({ sheet }: { sheet: ReturnType<typeof useSearchSheet> }) {
  const { open, setOpen, field } = sheet;
  const s = useSearch(24);
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const path = usePathname();
  const id = useId();

  useLayoutEffect(() => {
    if (root.current) root.current.inert = !open;
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    field.current?.blur();
  }, [field, setOpen]);

  useEffect(() => {
    if (!open) return;
    s.prepare();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, close]);

  // A new page closes it and empties the field (after the fade).
  useEffect(() => {
    setOpen(false);
    const t = window.setTimeout(s.reset, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Nothing typed and nothing recent: a few to start from.
  const starters = s.items.length
    ? [...s.items.filter((h) => h.kind === "Investor").slice(0, 3), ...s.items.filter((h) => h.kind === "Politician").slice(0, 2), ...s.items.filter((h) => h.ticker).slice(0, 3)]
    : [];
  const showStarters = !s.needle && s.hits.length === 0 && starters.length > 0;

  return (
    <div ref={root} data-open={open ? "" : undefined} className="search-sheet fixed inset-0 z-50 md:hidden" aria-hidden={!open}>
      <div aria-hidden="true" onClick={close} className="search-scrim absolute inset-0" />
      <div className="pointer-events-none relative flex h-full flex-col px-4 pt-[max(0.75rem,calc(var(--edge-top)_-_0.25rem))]">
        <div className="search-bar pointer-events-auto flex items-center gap-2">
          <label htmlFor={id} className="sr-only">Search stocks, investors and politicians</label>
          <div className="relative min-w-0 flex-1">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-ink/60" />
            <input
              ref={field}
              id={id}
              type="search"
              enterKeyHint="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={`${id}-results`}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={s.q}
              onChange={(e) => {
                s.setQ(e.target.value);
                s.setActive(-1);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const first = s.needle ? s.hits[0] : undefined;
                if (first) {
                  s.remember(first);
                  router.push(first.href);
                } else if (s.needle) router.push(`/feed?q=${encodeURIComponent(s.q.trim())}`);
              }}
              className="search-capsule h-12 w-full rounded-full !pl-12 pr-4 text-[17px] text-ink outline-none"
            />
          </div>
          <button type="button" onClick={close} className="press-sm min-h-11 shrink-0 rounded-full px-2 text-[17px] font-medium text-ink">
            Cancel
          </button>
        </div>
        <div onClick={(e) => e.target === e.currentTarget && close()} className="search-results no-scrollbar pointer-events-auto -mx-4 mt-3 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {open && (
            <>
              <Results s={s} id={id} large onPick={(hit) => s.remember(hit)} onAll={() => {}} />
              {showStarters && (
                <>
                  <div className="px-3 pb-1 pt-2 text-[15px] font-semibold text-subtle">Start with</div>
                  <ul aria-label="Suggestions">
                    {starters.map((hit, i) => (
                      <li key={hit.href} className="search-row" style={{ "--i": i } as CSSProperties}>
                        <Link href={hit.href} onClick={() => s.remember(hit)} className="flex min-h-14 items-center gap-3.5 rounded-2xl px-3 py-2 text-[17px] text-ink active:bg-ink/[0.08]">
                          <HitFace hit={hit} size={40} />
                          <span className="min-w-0 flex-1 truncate font-medium">{hit.name}</span>
                          <span className="shrink-0 text-[13px] text-subtle">{hit.kind}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
