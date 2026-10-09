"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Avatar } from "@/components/Avatar";
import { ErrorRetry } from "@/components/ErrorRetry";
import { FollowButton } from "@/components/FollowButton";
import { InvestorView, loadInvestor } from "@/components/InvestorView";
import { loadPolitician, PoliticianView } from "@/components/PoliticianView";
import { SearchBox } from "@/components/SearchBox";
import { Skeleton } from "@/components/Skeleton";
import { BackButton } from "@/components/ui";
import { type DialHandle, WatchDial } from "@/components/WatchDial";
import { fetchCatalogue } from "@/lib/fetchJson";
import type { InvestorDetail, InvestorsResponse, PoliticianDetail, PoliticiansResponse, PoliticianRow } from "@/lib/types";
import { getFollowed, personHref, watchedPeople, type WatchedPerson } from "@/lib/watchlist";

/*
 * A person's page opened from "Your watchlist" on Home swipes sideways to
 * the other people of that row, investors and politicians (after the user's
 * reference video, 2026-10-07). The page follows the finger with the next
 * one beside it, and the names above turn like a wheel (`WatchDial`). A far
 * or quick swipe moves on, a short one springs back; three or more people go
 * round in a loop, two stop at either end. Arrow keys, a sideways trackpad
 * swipe and a tap on a neighbour's name move too.
 *
 * As in the video, the wheel is the top of the screen, right under the
 * Dynamic Island: on phones the site header (wordmark and search) gives way
 * while the pager is open (`[data-watch-pager]` in globals.css), and the
 * search moves into the row with the back button below the wheel.
 *
 * Everything that moves is driven by one number, p, the position in the
 * list; React only hears about it when a page has settled. The URL follows
 * (replaced, so Back still returns to Home). Touches on things that drag
 * sideways themselves (card rows, charts, the 3D allocation) are left alone,
 * and so are the outer 24 px, the system's back gesture.
 */

const GAP = 32; // between two pages, px
const EDGE = 24;
const EASE = bezier(0.32, 0.72, 0, 1);
// The curve starts 2.25 times faster than linear, used to carry a flick on.
const EASE_START = 0.72 / 0.32;

type Kind = WatchedPerson["kind"];
type Entry = { kind: Kind; slug: string; name: string; photo: string | null };
type Detail = { kind: "investor"; inv: InvestorDetail } | { kind: "politician"; pol: PoliticianDetail };
type Data = Detail | null | "error";

const keyOf = (e: { kind: Kind; slug: string }) => `${e.kind}:${e.slug}`;

async function load(e: { kind: Kind; slug: string }): Promise<Detail | null> {
  if (e.kind === "politician") {
    const pol = await loadPolitician(e.slug);
    return pol && { kind: "politician", pol };
  }
  const inv = await loadInvestor(e.slug);
  return inv && { kind: "investor", inv };
}

/** The head of a person's page while it loads: picture and name, as far as known. */
function HeadPlaceholder({ entry }: { entry: Entry }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-5">
      <div className="flex flex-col items-center gap-4 text-center">
        {entry.name ? <Avatar name={entry.name} src={entry.photo} kind={entry.kind} size={entry.kind === "politician" ? 104 : 96} /> : <Skeleton className="h-24 w-24 rounded-full" />}
        {entry.name ? <h1 className="large-title">{entry.name}</h1> : <Skeleton className="h-8 w-56" />}
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

export function WatchPager({ start }: { start: { kind: Kind; slug: string } }) {
  // The page that was opened; later URL changes are this pager's own.
  const [first] = useState(start);
  const [ring, setRing] = useState<Entry[]>([{ ...first, name: "", photo: null }]);
  const [cur, setCur] = useState(0);
  const [data, setData] = useState<Record<string, Data>>({});
  const [attempt, setAttempt] = useState(0);

  const root = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const dial = useRef<DialHandle>(null);
  const m = useRef({ p: 0, cur: 0, w: 0, top: 0, raf: 0, moving: false, n: 1, loop: false });

  const n = ring.length;
  const loop = n >= 3;
  const exists = (k: number) => n > 1 && (loop || (k >= 0 && k < n));
  const at = (k: number) => ring[mod(k, n)];
  m.current.n = n;
  m.current.loop = loop;

  // The watchlist, in Home's order, snapshotted on arrival: following or
  // unfollowing here does not reshuffle the pages under the finger.
  useEffect(() => {
    let live = true;
    Promise.all([
      fetchCatalogue<InvestorsResponse>("/api/investors"),
      fetchCatalogue<PoliticiansResponse>("/api/politicians").catch(() => ({ rows: [] as PoliticianRow[] })),
    ])
      .then(([iv, po]) => {
        if (!live) return;
        const list = watchedPeople(iv.rows, po.rows, { investor: getFollowed("investor"), politician: getFollowed("politician") });
        const i = list.findIndex((e) => keyOf(e) === keyOf(first));
        if (i >= 0) {
          setRing(list);
          setCur(i);
        } else {
          // No longer followed: just this one, named.
          const all = watchedPeople(iv.rows, po.rows, { investor: [first.slug], politician: [first.slug] });
          const self = all.find((e) => keyOf(e) === keyOf(first));
          if (self) setRing([self]);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [first]);

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
        if (top > 0) window.scrollTo({ top: window.scrollY - top, behavior: "instant" });
      }
      rest();
    },
    [rest],
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
  const url = personHref(current, true);
  useEffect(() => {
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [url]);

  // The names under the header get a plain backing once they stick.
  useEffect(() => {
    const el = band.current;
    if (!el) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const top = parseFloat(getComputedStyle(el).top) || 0;
      el.toggleAttribute("data-stuck", window.scrollY > 0 && el.getBoundingClientRect().top <= top + 0.5);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

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
      return d.kind === "investor" ? <InvestorView inv={d.inv} preview={o !== 0} centred /> : <PoliticianView pol={d.pol} preview={o !== 0} centred />;
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
          <Link href="/" className="text-ink underline">Back to Home</Link>
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
  const names = ring.map((e) => {
    const d = data[keyOf(e)];
    return e.name || (d && d !== "error" ? (d.kind === "investor" ? d.inv.person ?? d.inv.fund : d.pol.name) : "");
  });
  const prevName = exists(cur - 1) ? names[mod(cur - 1, n)] : null;
  const nextName = exists(cur + 1) ? names[mod(cur + 1, n)] : null;

  return (
    <div ref={root} data-noswipe data-watch-pager className="[overflow-anchor:none] max-md:-mt-4">
      {/* The wheel first, under the Dynamic Island (see globals.css). */}
      <nav ref={band} aria-label="Your watchlist" className="watch-band sticky z-10 -mx-4">
        {names.every(Boolean) && (
          <WatchDial
            ref={dial}
            names={names}
            loop={loop}
            cur={cur}
            onPick={(k) => {
              if (k !== m.current.cur) step(k > m.current.cur ? 1 : -1);
            }}
          />
        )}
        {!names.every(Boolean) && <div className="h-16" />}
        {prevName && (
          <button type="button" onClick={() => step(-1)} className="btn-capsule sr-only focus-visible:not-sr-only focus-visible:!absolute focus-visible:bottom-2 focus-visible:left-4">
            Previous: {prevName}
          </button>
        )}
        {nextName && (
          <button type="button" onClick={() => step(1)} className="btn-capsule sr-only focus-visible:not-sr-only focus-visible:!absolute focus-visible:bottom-2 focus-visible:right-4">
            Next: {nextName}
          </button>
        )}
      </nav>

      <div className="relative z-[1] mt-1 flex min-h-11 items-center justify-between gap-3">
        <BackButton href="/" label="Home" />
        <div className="flex items-center gap-2.5">
          <FollowButton kind={current.kind} id={current.slug} />
          {/* The header's search, which gives way to the wheel on phones. */}
          <div className="md:hidden">
            <SearchBox openWidth="w-40" />
          </div>
        </div>
      </div>

      <div className="isolate -mx-4 overflow-x-clip px-4 pt-5">
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
