"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { WatchPager } from "@/components/WatchPager";
import { haptic } from "@/lib/haptic";
import type { WatchEntry } from "@/lib/watchlist";

/*
 * The watchlist's swipe view as a layer over the list (user, 2026-10-09),
 * like iOS's zoom transition: tapping a row grows the page out of that row
 * while the picture (or logo) flies from the row to its place, and closing
 * shrinks it back into the row of whoever is shown now, the picture flying
 * home. Closing: a tap on the band of names, pulling the page down from the
 * top (it follows the finger and shrinks; let go past a point, or flick, and
 * it goes, else it springs back), tapping the star tab again, or Escape.
 *
 * The layer scrolls on its own, so the list below keeps its place, and sits
 * under the tab bar, which stays as it is. While it is open the row it came
 * from shows no picture (the page has it), as in iOS.
 */

const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const OPEN_MS = 560;
const CLOSE_MS = 460;
// Pull distance that closes on release, and the flick speed that does too.
const PULL = 120;
const FLICK = 0.55; // px per ms

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const rowOf = (key: string) => document.querySelector<HTMLElement>(`[data-row="${CSS.escape(key)}"]`);
const keyOf = (e: { kind: string; slug: string }) => `${e.kind}/${e.slug}`;
const onScreen = (r: DOMRect) => r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;

/**
 * A copy of `face` flying from `from` to `to` (viewport rects), drawn above
 * everything; the copy is laid out at the face's own size and only scaled,
 * so the big picture stays sharp. Resolves with the copy (to remove later).
 */
function fly(face: HTMLElement, from: DOMRect, to: DOMRect, ms: number): Promise<HTMLElement> {
  const w = face.offsetWidth || from.width;
  const copy = face.cloneNode(true) as HTMLElement;
  copy.removeAttribute("data-face");
  copy.setAttribute("aria-hidden", "true");
  Object.assign(copy.style, { position: "fixed", left: "0", top: "0", margin: "0", zIndex: "27", pointerEvents: "none", transformOrigin: "0 0", visibility: "visible" });
  document.body.appendChild(copy);
  const at = (r: DOMRect) => `translate3d(${r.left}px, ${r.top}px, 0) scale(${r.width / w})`;
  const motion = copy.animate([{ transform: at(from) }, { transform: at(to) }], { duration: ms, easing: SPRING, fill: "forwards" });
  return motion.finished.then(
    () => copy,
    () => copy,
  );
}

export function WatchSheet({ entries, start, from, onTurn, onClosed }: { entries: WatchEntry[]; start: number; from: string | null; onTurn: (e: WatchEntry) => void; onClosed: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const shown = useRef(keyOf(entries[start] ?? entries[0]));
  const phase = useRef<"opening" | "open" | "closing">("opening");
  const done = useRef(onClosed);
  done.current = onClosed;

  useEffect(() => setHost(document.body), []);

  const face = () => root.current?.querySelector<HTMLElement>('[data-o="0"] [data-face]') ?? null;
  const flying = (on: boolean) => root.current?.toggleAttribute("data-flying", on);

  // Open: out of the row (or, arriving by link, rising into place).
  useLayoutEffect(() => {
    const c = card.current;
    if (!host || !c) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    root.current?.focus({ preventScroll: true });
    const finish = () => {
      if (phase.current === "opening") phase.current = "open";
    };
    if (reducedMotion()) {
      finish();
    } else {
      const row = from ? rowOf(from) : null;
      const rr = row?.getBoundingClientRect();
      const src = row?.querySelector<HTMLElement>("[data-face]");
      const dst = face();
      if (rr && onScreen(rr)) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // The page grows out of the row; it fades in over the first stretch,
        // so the row never turns into a blank tile.
        c.animate([{ clipPath: `inset(${rr.top}px ${vw - rr.right}px ${vh - rr.bottom}px ${rr.left}px round 18px)` }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: OPEN_MS, easing: SPRING });
        c.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }], { duration: OPEN_MS, easing: "linear" });
        content.current?.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 340, delay: 110, easing: "ease-out", fill: "backwards" });
        scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS, easing: "ease-out" });
        if (src && dst) {
          flying(true);
          void fly(dst, src.getBoundingClientRect(), dst.getBoundingClientRect(), OPEN_MS).then((copy) => {
            flying(false);
            copy.remove();
          });
        }
        window.setTimeout(finish, OPEN_MS);
      } else {
        c.animate([{ opacity: 0, transform: "translateY(32px) scale(0.98)" }, { opacity: 1, transform: "none" }], { duration: 460, easing: SPRING });
        window.setTimeout(finish, 460);
      }
    }
    return () => {
      html.style.overflow = before;
    };
    // Runs once, when the layer appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  /** Back into the row of whoever is shown now, the picture flying home. */
  const close = useCallback(() => {
    const c = card.current;
    if (!c || phase.current === "closing") return;
    phase.current = "closing";
    const end = (copy?: HTMLElement) => {
      done.current();
      // The row shows its picture again first, then the copy goes.
      requestAnimationFrame(() => requestAnimationFrame(() => copy?.remove()));
    };
    if (reducedMotion()) return end();

    const row = rowOf(shown.current);
    // A row out of sight is scrolled to first (the list is still covered).
    if (row) {
      const r = row.getBoundingClientRect();
      if (!onScreen(r) || r.bottom > window.innerHeight - 100) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - window.innerHeight / 2 + r.height / 2), behavior: "instant" });
    }
    const rr = row?.getBoundingClientRect();
    const radius = parseFloat(c.style.borderRadius) || 0;
    const now = getComputedStyle(c).transform;
    const fromFrame = { transform: now === "none" ? "none" : now, clipPath: `inset(0px 0px 0px 0px round ${radius}px)` };
    const scrimNow = Number(getComputedStyle(scrim.current!).opacity);
    scrim.current?.animate([{ opacity: scrimNow }, { opacity: 0 }], { duration: CLOSE_MS, easing: "ease-out", fill: "forwards" });

    if (rr && onScreen(rr)) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      c.animate([fromFrame, { transform: "none", clipPath: `inset(${rr.top}px ${vw - rr.right}px ${vh - rr.bottom}px ${rr.left}px round 18px)` }], { duration: CLOSE_MS, easing: SPRING, fill: "forwards" });
      // Gone before it reaches the row, which shows through again.
      c.animate([{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { duration: CLOSE_MS, easing: "linear", fill: "forwards", composite: "replace" });
      content.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" });
      const src = face();
      const dst = row?.querySelector<HTMLElement>("[data-face]");
      const a = src?.getBoundingClientRect();
      if (src && dst && a && onScreen(a)) {
        flying(true);
        void fly(src, a, dst.getBoundingClientRect(), CLOSE_MS).then(end);
        return;
      }
      window.setTimeout(() => end(), CLOSE_MS);
    } else {
      c.animate([fromFrame, { transform: `translate3d(0, ${window.innerHeight}px, 0)`, clipPath: fromFrame.clipPath }], { duration: 380, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" });
      window.setTimeout(() => end(), 380);
    }
  }, []);

  // Pull down from the top to close: the page follows the finger, shrinking a
  // little and rounding its corners, the list showing through behind.
  useEffect(() => {
    const sc = scroller.current;
    const c = card.current;
    if (!host || !sc || !c) return;
    let state: "idle" | "maybe" | "drag" = "idle";
    let x0 = 0;
    let y0 = 0;
    let d = 0;
    let armed = false;
    let trail: { t: number; y: number }[] = [];

    const blocked = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return true;
      if (target.closest("[data-sheet-nodrag], input, textarea, select, [contenteditable='true']")) return true;
      if (document.querySelector("dialog[open]") || document.body.style.position === "fixed") return true;
      for (let el: Element | null = target; el && el !== sc; el = el.parentElement) if (getComputedStyle(el).touchAction === "none") return true;
      return false;
    };
    const draw = (px: number) => {
      d = px;
      const s = Math.max(0.82, 1 - px / 1600);
      c.style.transform = `translate3d(0, ${px.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
      c.style.borderRadius = `${Math.min(40, 14 + px / 5).toFixed(1)}px`;
      if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - px / 520));
    };
    const reset = () => {
      c.style.transform = "";
      c.style.borderRadius = "";
      c.style.willChange = "";
      if (scrim.current) scrim.current.style.opacity = "";
    };

    const onStart = (e: TouchEvent) => {
      state = "idle";
      if (phase.current !== "open" || e.touches.length !== 1 || sc.scrollTop > 0 || blocked(e.target)) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      state = "maybe";
    };
    const onMove = (e: TouchEvent) => {
      if (state === "idle") return;
      const t = e.touches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (state === "maybe") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Downwards and mostly vertical, from the very top; anything else is
        // a scroll or a sideways swipe to the next page.
        if (dy <= 0 || Math.abs(dy) < Math.abs(dx) * 1.2 || sc.scrollTop > 0) {
          state = "idle";
          return;
        }
        state = "drag";
        armed = false;
        trail = [];
        c.getAnimations().forEach((a) => a.cancel());
        c.style.willChange = "transform";
        y0 = t.clientY;
      }
      // Keeps the browser's own bounce out of it.
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      trail.push({ t: now, y: t.clientY });
      while (trail.length > 2 && now - trail[0].t > 100) trail.shift();
      draw(Math.max(0, t.clientY - y0));
      if (d >= PULL !== armed) {
        armed = d >= PULL;
        if (armed) haptic();
      }
    };
    const onEnd = () => {
      if (state !== "drag") {
        state = "idle";
        return;
      }
      state = "idle";
      const a = trail[0];
      const b = trail[trail.length - 1];
      const v = a && b && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
      if (d >= PULL || (v > FLICK && d > 24)) return close();
      // Not far enough: back up into place.
      const from = { transform: c.style.transform, borderRadius: c.style.borderRadius };
      reset();
      c.animate([from, { transform: "none", borderRadius: "0px" }], { duration: 420, easing: SPRING });
      scrim.current?.animate([{ opacity: Math.max(0, 1 - d / 520) }, { opacity: 1 }], { duration: 420, easing: SPRING });
    };

    sc.addEventListener("touchstart", onStart, { passive: true });
    sc.addEventListener("touchmove", onMove, { passive: false });
    sc.addEventListener("touchend", onEnd);
    sc.addEventListener("touchcancel", onEnd);
    return () => {
      sc.removeEventListener("touchstart", onStart);
      sc.removeEventListener("touchmove", onMove);
      sc.removeEventListener("touchend", onEnd);
      sc.removeEventListener("touchcancel", onEnd);
    };
  }, [host, close]);

  // Escape, and the star tab tapped again, close it too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A sheet or the search on top takes its own Escape.
      if (e.key === "Escape" && !document.querySelector("dialog[open], .search-sheet[data-open]")) close();
    };
    const again = (e: Event) => {
      if ((e as CustomEvent<string>).detail === "/watchlist") close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("outsider:tab-again", again);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("outsider:tab-again", again);
    };
  }, [close]);

  const turn = useCallback(
    (e: WatchEntry) => {
      shown.current = keyOf(e);
      onTurn(e);
    },
    [onTurn],
  );

  if (!host) return null;
  return createPortal(
    <div ref={root} role="dialog" aria-modal="true" aria-label={entries[0]?.kind === "stock" ? "Your stocks" : "The people you follow"} tabIndex={-1} className="watch-sheet outline-none">
      <div ref={scrim} aria-hidden="true" className="watch-sheet-scrim fixed inset-0 z-[25]" />
      <div ref={card} className="watch-sheet-card fixed inset-0 z-[26] overflow-hidden">
        <div ref={scroller} className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-y-contain">
          <div ref={content} className="mx-auto max-w-5xl px-4 pb-32">
            <WatchPager people={entries} start={start} scroller={scroller} onClose={close} onTurn={turn} />
          </div>
        </div>
        <div aria-hidden="true" className="scroll-edge-bottom pointer-events-none absolute inset-x-0 bottom-0 h-28 md:hidden" />
      </div>
    </div>,
    host,
  );
}
