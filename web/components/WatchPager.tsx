"use client";

import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ErrorRetry } from "@/components/ErrorRetry";
import { InvestorView, loadInvestor } from "@/components/InvestorView";
import { loadPolitician, PoliticianView } from "@/components/PoliticianView";
import { Skeleton } from "@/components/Skeleton";
import { loadStock, StockView } from "@/components/StockView";
import { type DialHandle, WatchDial } from "@/components/WatchDial";
import type { InvestorDetail, PoliticianDetail, StockDetail } from "@/lib/types";
import type { WatchEntry } from "@/lib/watchlist";

/*
 * The swipe view of the watchlist (the star tab, user, 2026-10-09; first
 * built after the user's reference video, 2026-10-07): one page at a time,
 * swiping sideways to the next: the people you follow (investors and
 * politicians), or the stocks you follow, each the same way. The page
 * follows the finger with the next one beside it, and the names above turn
 * like a wheel (`WatchDial`). A far or quick swipe moves on, a short one
 * springs back; three or more people go round in a loop, two stop at either
 * end. Arrow keys and a sideways trackpad swipe move too.
 *
 * Nothing sits between the wheel and the picture: no back button, no
 * Follow capsule (user, 2026-10-09). A tap on the band of names closes the
 * view, back to the list (`onClose`); a drag on it turns the wheel.
 *
 * It lives in `WatchSheet`, a layer over the list with its own scrolling
 * (`scroller`); as in the video, the wheel is the top of the screen, right
 * under the Dynamic Island. At the top of the page the band is clear and the
 * page's aura runs up behind the names; scrolled, a backing in the page
 * colour fades in under them (`--fill`), so no edge ever cuts the aura.
 *
 * Everything that moves is driven by one number, p, the position in the
 * list; React only hears about it when a page has settled (`onTurn`).
 * Touches on things that drag sideways themselves (card rows, charts, the
 * 3D allocation) are left alone, and so are the outer 24 px, the system's
 * back gesture.
 */

const GAP = 32; // between two pages, px
const EDGE = 24;
const EASE = bezier(0.32, 0.72, 0, 1);
// The curve starts 2.25 times faster than linear, used to carry a flick on.
const EASE_START = 0.72 / 0.32;

type Kind = WatchEntry["kind"];
type Entry = WatchEntry;
type Detail = { kind: "investor"; inv: InvestorDetail } | { kind: "politician"; pol: PoliticianDetail } | { kind: "stock"; stock: StockDetail };
type Data = Detail | null | "error";

const keyOf = (e: { kind: Kind; slug: string }) => `${e.kind}:${e.slug}`;

async function load(e: { kind: Kind; slug: string }): Promise<Detail | null> {
  if (e.kind === "stock") {
    const stock = await loadStock(e.slug);
    return stock && { kind: "stock", stock };
  }
  if (e.kind === "politician") {
    const pol = await loadPolitician(e.slug);
    return pol && { kind: "politician", pol };
  }
  const inv = await loadInvestor(e.slug);
  return inv && { kind: "investor", inv };
}

/** The head of a page while it loads: picture (or logo) and name, where the page will put them. */
function HeadPlaceholder({ entry }: { entry: Entry }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-5">
      <div className="flex flex-col items-center gap-4 text-center">
        {entry.kind === "stock" ? (
          <span data-face className="flex rounded-[24px]">
            <CompanyLogo ticker={entry.slug} company={entry.name} size={88} rounded="rounded-[24px]" className="logo-lift" />
          </span>
        ) : (
          <span data-face className="flex rounded-full">
            <Avatar name={entry.name} src={entry.photo} kind={entry.kind} size={entry.kind === "politician" ? 104 : 96} className="shadow-[0_10px_30px_rgb(0_0_0/0.14)]" />
          </span>
        )}
        <div>
          <h1 className="large-title">{entry.name}</h1>
          {entry.kind === "stock" && <div className="mt-1 text-[15px] font-medium text-subtle">{entry.slug}</div>}
        </div>
      </div>
      <Skeleton className="mx-auto h-4 w-full max-w-xl" />
      <Skeleton className="h-[74px] w-full rounded-[22px]" />
      <Skeleton className="h-72 w-full rounded-[22px]" />
    </div>
  );
}

const mod = (k: number, n: number) => ((k % n) + n) % n;

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const y = (t: number) => ((ay * t + by) * t + cy) * t;
  return (s: number) => {
    let t = s;
    for (let i = 0; i < 8; i++) {
      const e = x(t) - s;
      if (Math.abs(e) < 1e-5) break;
      t -= e / dx(t);
    }
    return y(Math.min(1, Math.max(0, t)));
  };
}

export function WatchPager({ people, start, scroller, onClose, onTurn }: { people: Entry[]; start: number; scroller: RefObject<HTMLElement>; onClose: () => void; onTurn?: (person: Entry) => void }) {
  // The watchlist as it was on arrival: following or unfollowing meanwhile
  // does not reshuffle the pages under the finger.
  const [ring] = useState(people);
  const [cur, setCur] = useState(() => Math.max(0, Math.min(start, people.length - 1)));
  const [data, setData] = useState<Record<string, Data>>({});
  const [attempt, setAttempt] = useState(0);

  const root = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const dial = useRef<DialHandle>(null);
  const m = useRef({ p: cur, cur, w: 0, top: 0, raf: 0, moving: false, n: 1, loop: false, dragged: 0 });

  const n = ring.length;
  const loop = n >= 3;
  const exists = (k: number) => n > 1 && (loop || (k >= 0 && k < n));
  const at = (k: number) => ring[mod(k, n)];
  m.current.n = n;
  m.current.loop = loop;

  // The current investor first, then the two beside it, so a swipe finds
  // them ready. Investors further away are let go.
  const nearKey = [0, 1, -1].filter((o) => o === 0 || exists(cur + o)).map((o) => keyOf(at(cur + o))).join(" ");
  useEffect(() => {
    let live = true;
    const keep = new Set([-2, -1, 0, 1, 2].map((o) => keyOf(at(cur + o))));
    setData((d) => Object.fromEntries(Object.entries(d).filter(([k]) => keep.has(k))));
    (async () => {
      for (const key of nearKey.split(" ")) {
        if (!live) return;
        const [kind, ...rest] = key.split(":");
        let value: Data;
        try {
          value = await load({ kind: kind as Kind, slug: rest.join(":") });
        } catch {
          value = "error";
        }
        setData((d) => (d[key] === value ? d : { ...d, [key]: value }));
      }
    })();
    return () => {
      live = false;
    };
    // `nearKey` stands for `cur` and `ring`.
  }, [nearKey, attempt]);

  /* ── Motion ─────────────────────────────────────────────────────────── */

  // The pages beside the current one stay hidden and flat until something
  // moves; then they open at the height the reader is looking at, unclipped,
  // so their aura runs into the current page's instead of ending in an edge.
  const placeSides = useCallback((moving: boolean) => {
    const r = rail.current;
    if (!r) return;
    for (const el of r.querySelectorAll<HTMLElement>("[data-o]")) {
      const open = el.dataset.o !== "0" && moving;
      el.inert = el.dataset.o !== "0";
      el.style.top = open ? `${m.current.top}px` : "";
      el.style.height = open ? "auto" : "";
      el.style.overflow = open ? "visible" : "";
      el.style.visibility = open ? "visible" : "";
    }
  }, []);

  const apply = useCallback((p: number) => {
    const s = m.current;
    s.p = p;
    const f = p - s.cur;
    if (rail.current) rail.current.style.transform = Math.abs(f) > 1e-4 ? `translate3d(${(-f * (s.w + GAP)).toFixed(2)}px,0,0)` : "";
    dial.current?.set(p);
  }, []);

  const prepare = useCallback(() => {
    const s = m.current;
    if (s.moving || !rail.current || !band.current) return;
    const r = rail.current.getBoundingClientRect();
    s.w = r.width;
    // Scrolled down, the neighbour shows its head right under the names.
    s.top = Math.max(0, Math.round(band.current.getBoundingClientRect().bottom - r.top));
    s.moving = true;
    placeSides(true);
  }, [placeSides]);

  const rest = useCallback(() => {
    m.current.moving = false;
    placeSides(false);
  }, [placeSides]);

  const can = useCallback((dir: 1 | -1) => {
    const s = m.current;
    return s.n > 1 && (s.loop || (s.cur + dir >= 0 && s.cur + dir < s.n));
  }, []);

  const finish = useCallback(
    (target: number) => {
      const s = m.current;
      s.raf = 0;
      if (target !== s.cur) {
        const top = s.top;
        flushSync(() => setCur(target));
        // The new page now sits at the top of the list; scroll so it stays
        // exactly where it slid in.
        if (top > 0 && scroller.current) scroller.current.scrollTop -= top;
      }
      rest();
    },
    [rest, scroller],
  );

  /** Turns to `target` (a whole position); `speed` carries on a flick, in pages per ms. */
  const go = useCallback(
    (target: number, speed = 0) => {
      const s = m.current;
      cancelAnimationFrame(s.raf);
      prepare();
      const from = s.p;
      const dist = target - from;
      if (Math.abs(dist) < 1e-3 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        apply(target);
        return finish(target);
      }
      const plain = 300 + 220 * Math.min(1, Math.abs(dist));
      const carried = speed > 0 ? (EASE_START * Math.abs(dist)) / speed : plain;
      const dur = Math.min(plain, Math.max(220, carried));
      const t0 = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        apply(from + dist * EASE(t));
        if (t < 1) s.raf = requestAnimationFrame(frame);
        else finish(target);
      };
      s.raf = requestAnimationFrame(frame);
    },
    [apply, finish, prepare],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      const s = m.current;
      if (s.raf || !can(dir)) return;
      go(s.cur + dir);
    },
    [can, go],
  );

  // After a page settles (or the list arrives): the rail back in place, the
  // sides hidden again, the URL on the new investor.
  useLayoutEffect(() => {
    const s = m.current;
    s.cur = cur;
    if (!s.moving) s.p = cur;
    apply(s.p);
  }, [cur, apply]);
  useLayoutEffect(() => placeSides(m.current.moving));
  const current = at(cur);
  const turned = useRef(onTurn);
  turned.current = onTurn;
  useEffect(() => {
    turned.current?.(current);
  }, [current]);

  // The band's backing fades in as the page scrolls under the names, from
  // nothing at the top (the aura runs up behind them, user, 2026-10-09) to
  // the full page colour once the aura has scrolled away.
  useEffect(() => {
    const el = band.current;
    const sc = scroller.current;
    if (!el || !sc) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      el.style.setProperty("--fill", Math.min(1, Math.max(0, (sc.scrollTop - 12) / 180)).toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      sc.removeEventListener("scroll", onScroll);
    };
  }, [scroller]);

  /* ── Input ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const blocked = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !el.contains(target)) return true;
      if (target.closest("input, textarea, select, [contenteditable='true'], [data-sheet-nodrag]")) return true;
      if (document.querySelector("dialog[open]") || document.body.style.position === "fixed") return true;
      for (let node: Element | null = target; node && node !== el; node = node.parentElement) {
        if (node.hasAttribute("data-noswipe")) return true;
        const cs = getComputedStyle(node);
        if (cs.touchAction === "none" || cs.touchAction === "pan-y") return true;
        if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && node.scrollWidth > node.clientWidth + 2) return true;
      }
      return false;
    };

    // Past the last page (without a loop) the rail only gives a little.
    const bounded = (p: number) => {
      const s = m.current;
      const lo = s.cur - (can(-1) ? 1 : 0);
      const hi = s.cur + (can(1) ? 1 : 0);
      if (p < lo) return lo - Math.min(0.16, (lo - p) * 0.25);
      if (p > hi) return hi + Math.min(0.16, (p - hi) * 0.25);
      return p;
    };

    /** Where to go after letting go, from the offset and the speed (pages per ms, + towards the next). */
    const settle = (v: number) => {
      const s = m.current;
      const f = s.p - s.cur;
      let dir: -1 | 0 | 1 = 0;
      if (Math.abs(v) > 0.0011 && Math.abs(f) > 0.03 && Math.sign(v) === Math.sign(f)) dir = v > 0 ? 1 : -1;
      else if (Math.abs(f) > 0.33) dir = f > 0 ? 1 : -1;
      if (dir && !can(dir)) dir = 0;
      go(s.cur + dir, dir ? Math.abs(v) : 0);
    };

    // Touch.
    let state: "idle" | "maybe" | "drag" = "idle";
    let x0 = 0;
    let y0 = 0;
    let p0 = 0;
    let trail: { t: number; x: number }[] = [];
    const onStart = (e: TouchEvent) => {
      state = "idle";
      if (m.current.n < 2 || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      if (blocked(e.target)) return;
      x0 = t.clientX;
      y0 = t.clientY;
      state = "maybe";
    };
    const onMove = (e: TouchEvent) => {
      if (state === "idle") return;
      const t = e.touches[0];
      if (state === "maybe") {
        const dx = t.clientX - x0;
        const dy = t.clientY - y0;
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        // Mostly vertical: a scroll.
        if (Math.abs(dx) < Math.abs(dy) * 1.2) {
          state = "idle";
          return;
        }
        state = "drag";
        // Caught in flight: carry on from where the wheel is.
        cancelAnimationFrame(m.current.raf);
        m.current.raf = 0;
        prepare();
        x0 = t.clientX;
        p0 = m.current.p;
        trail = [];
      }
      e.preventDefault();
      const now = performance.now();
      trail.push({ t: now, x: t.clientX });
      while (trail.length > 2 && now - trail[0].t > 90) trail.shift();
      apply(bounded(p0 - (t.clientX - x0) / (m.current.w + GAP)));
    };
    const onEnd = () => {
      if (state !== "drag") {
        state = "idle";
        return;
      }
      state = "idle";
      m.current.dragged = performance.now();
      const a = trail[0];
      const b = trail[trail.length - 1];
      const v = a && b && b.t > a.t ? -(b.x - a.x) / (b.t - a.t) / (m.current.w + GAP) : 0;
      settle(v);
    };

    // Trackpad: a sideways two-finger swipe follows like a drag; its
    // momentum tail after a page has turned is swallowed.
    let wheeling = false;
    let acc = 0;
    let quietUntil = 0;
    let wheelTimer = 0;
    const onWheel = (e: WheelEvent) => {
      if (m.current.n < 2 || Math.abs(e.deltaX) <= Math.abs(e.deltaY) || e.ctrlKey) return;
      if (blocked(e.target)) return;
      e.preventDefault();
      const now = performance.now();
      if (!wheeling && now < quietUntil) {
        quietUntil = now + 160;
        return;
      }
      if (!wheeling) {
        cancelAnimationFrame(m.current.raf);
        m.current.raf = 0;
        prepare();
        wheeling = true;
        acc = 0;
        p0 = m.current.p;
      }
      acc += e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
      m.current.dragged = now;
      apply(bounded(p0 + acc / (m.current.w + GAP)));
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        wheeling = false;
        quietUntil = performance.now() + 160;
        settle(0);
      }, 120);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const a = document.activeElement;
      const free = !a || a === document.body || (el.contains(a) && a.matches("a, button") && !a.closest("[role='radiogroup'], [role='tablist'], [data-sheet-nodrag]"));
      if (!free || document.querySelector("dialog[open]")) return;
      const dir = e.key === "ArrowRight" ? 1 : -1;
      if (!can(dir)) return;
      e.preventDefault();
      step(dir);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(wheelTimer);
      cancelAnimationFrame(m.current.raf);
    };
  }, [apply, can, go, prepare, step]);

  /* ── Pages ──────────────────────────────────────────────────────────── */

  const page = (e: Entry, o: number) => {
    const key = keyOf(e);
    const d = data[key];
    if (d && d !== "error")
      return d.kind === "investor" ? (
        <InvestorView inv={d.inv} preview={o !== 0} still />
      ) : d.kind === "politician" ? (
        <PoliticianView pol={d.pol} preview={o !== 0} still />
      ) : (
        <StockView stock={d.stock} preview={o !== 0} still centred />
      );
    if (o === 0 && d === "error")
      return (
        <ErrorRetry
          onRetry={() => {
            setData((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== key)));
            setAttempt((a) => a + 1);
          }}
        />
      );
    if (o === 0 && d === null)
      return (
        <div className="py-16 text-center text-[15px] text-subtle">
          Not found.{" "}
          <button type="button" onClick={onClose} className="!min-h-0 text-ink underline">Back to the list</button>
        </div>
      );
    return <HeadPlaceholder entry={e} />;
  };

  // In list order, not screen order: React then never moves a page that
  // stays, which would restart its entrance animations.
  const slots = [-1, 0, 1]
    .filter((o) => o === 0 || exists(cur + o))
    .map((o) => ({ o, k: cur + o, entry: at(cur + o) }))
    .sort((a, b) => mod(a.k, n) - mod(b.k, n));
  const names = ring.map((e) => e.name);
  const prevName = exists(cur - 1) ? names[mod(cur - 1, n)] : null;
  const nextName = exists(cur + 1) ? names[mod(cur + 1, n)] : null;

  // A tap on the band closes the view; the click that ends a drag of the
  // wheel does not.
  const tapBand = () => {
    if (performance.now() - m.current.dragged < 400 || m.current.raf) return;
    onClose();
  };

  return (
    <div ref={root} data-noswipe data-watch-pager className="[overflow-anchor:none]">
      {/* The wheel first, under the Dynamic Island (see globals.css). */}
      <nav ref={band} aria-label="Your watchlist" onClick={tapBand} className="watch-band sticky z-10 -mx-4 cursor-pointer">
        <WatchDial ref={dial} names={names} loop={loop} cur={cur} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="btn-capsule sr-only focus-visible:not-sr-only focus-visible:!absolute focus-visible:bottom-2 focus-visible:left-1/2 focus-visible:-translate-x-1/2"
        >
          Back to the list
        </button>
        {prevName && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            className="btn-capsule sr-only focus-visible:not-sr-only focus-visible:!absolute focus-visible:bottom-2 focus-visible:left-4"
          >
            Previous: {prevName}
          </button>
        )}
        {nextName && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            className="btn-capsule sr-only focus-visible:not-sr-only focus-visible:!absolute focus-visible:bottom-2 focus-visible:right-4"
          >
            Next: {nextName}
          </button>
        )}
      </nav>

      <div className="isolate -mx-4 overflow-x-clip px-4 pt-3">
        <div ref={rail} className="relative">
          {slots.map(({ o, entry }) => (
            <div
              key={keyOf(entry)}
              data-o={o}
              aria-hidden={o !== 0 || undefined}
              className={o === 0 ? "relative" : "invisible absolute top-0 h-0 w-full overflow-hidden"}
              style={o === 0 ? undefined : { left: o > 0 ? `calc(100% + ${GAP}px)` : `calc(-100% - ${GAP}px)` }}
            >
              {page(entry, o)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
