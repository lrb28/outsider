"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { activeTab, TABS } from "@/components/Nav";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Swipe the page sideways to switch between the main tabs of the tab bar
 * (Home, Discover, Feed, Portfolio, Settings), never between a page's own
 * chips or filters (user, 2026-09-30). Works on every page, from the tab the
 * bar highlights. The content follows the finger, slides out and the next
 * tab slides in from the side it came from.
 *
 * Left alone: anything that scrolls or drags sideways itself (card rows, the
 * chip bar, charts, the 3D allocation), form fields, open sheets and
 * touches that start at the screen edge (the system's back gesture).
 */
export function SwipeNav() {
  const router = useRouter();
  const path = usePathname() || "/";
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const order = TABS.map((t) => t.href);
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let dx = 0;
    let state: "idle" | "maybe" | "swipe" | "off" = "idle";
    let busy = false;

    const neighbour = (dir: 1 | -1) => {
      const i = order.indexOf(activeTab(pathRef.current));
      // Pages outside the tab bar (methodology, privacy) don't swipe.
      return i < 0 ? undefined : order[i + dir];
    };

    const blocked = (target: Element | null) => {
      if (!target || !main.contains(target)) return true;
      if (target.closest("[data-noswipe], [data-sheet-nodrag], input, textarea, select, [contenteditable='true']")) return true;
      // A sheet or the welcome screen is open.
      if (document.querySelector("dialog[open]") || document.body.style.position === "fixed" || document.documentElement.style.overflow === "hidden") return true;
      for (let el: Element | null = target; el && el !== main; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.touchAction === "none" || cs.touchAction === "pan-y") return true;
        if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 2) return true;
      }
      return false;
    };

    const slide = (px: number, opacity: number, ms: number) => {
      main.style.transition = ms ? `transform ${ms}ms ${EASE}, opacity ${ms}ms ${EASE}` : "none";
      main.style.transform = px ? `translate3d(${px}px,0,0)` : "";
      main.style.opacity = opacity === 1 ? "" : String(opacity);
    };

    const commit = (dir: 1 | -1) => {
      const next = neighbour(dir);
      // First or last tab: spring back.
      if (!next) return slide(0, 1, 320);
      busy = true;
      const w = window.innerWidth;
      slide(-dir * w * 0.45, 0, 170);
      window.setTimeout(() => {
        router.push(next, { scroll: false });
        window.scrollTo({ top: 0 });
        slide(dir * w * 0.35, 0, 0);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            slide(0, 1, 360);
            window.setTimeout(() => {
              main.style.transition = "";
              busy = false;
            }, 380);
          }),
        );
      }, 170);
    };

    const onStart = (e: TouchEvent) => {
      state = "idle";
      if (busy || e.touches.length !== 1) return;
      const t = e.touches[0];
      // The outer 24 px belong to the system's back/forward swipe.
      if (t.clientX < 24 || t.clientX > window.innerWidth - 24) return;
      if (blocked(e.target as Element)) return;
      x0 = t.clientX;
      y0 = t.clientY;
      t0 = performance.now();
      dx = 0;
      state = "maybe";
    };
    const onMove = (e: TouchEvent) => {
      if (state !== "maybe" && state !== "swipe") return;
      const t = e.touches[0];
      dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (state === "maybe") {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        // Mostly vertical: a scroll, leave it be.
        if (Math.abs(dx) < Math.abs(dy) * 1.4) {
          state = "off";
          return;
        }
        state = "swipe";
      }
      e.preventDefault();
      // Follows the finger; at the first and last tab it resists.
      const edge = !neighbour(dx < 0 ? 1 : -1);
      slide(dx * (edge ? 0.2 : 0.6), 1 - Math.min(0.35, Math.abs(dx) / 900), 0);
    };
    const onEnd = () => {
      if (state !== "swipe") {
        state = "idle";
        return;
      }
      state = "idle";
      const speed = Math.abs(dx) / Math.max(1, performance.now() - t0);
      if (Math.abs(dx) > 80 || (Math.abs(dx) > 36 && speed > 0.45)) commit(dx < 0 ? 1 : -1);
      else slide(0, 1, 320);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      slide(0, 1, 0);
    };
  }, [router]);

  return null;
}
