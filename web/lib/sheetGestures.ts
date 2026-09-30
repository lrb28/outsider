"use client";

import { type RefObject, useEffect, useRef } from "react";

/*
 * Behaviour shared by everything that slides up over the page (Sheet, the
 * trade detail): the page behind must not scroll, and the sheet follows a
 * downward swipe and dismisses like a native one.
 */

let locks = 0;
let saved: { y: number; style: Partial<CSSStyleDeclaration> } | null = null;

/**
 * Freezes the page behind a sheet. `overflow: hidden` alone does not stop
 * iOS Safari from scrolling the body when a touch starts on the backdrop, so
 * the body is pinned in place and put back where it was afterwards. Nested
 * sheets share one lock.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    if (locks++ === 0) {
      const b = document.body.style;
      const y = window.scrollY;
      saved = { y, style: { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow } };
      b.position = "fixed";
      b.top = `-${y}px`;
      b.left = "0";
      b.right = "0";
      b.width = "100%";
      b.overflow = "hidden";
    }
    return () => {
      if (--locks > 0 || !saved) return;
      const { y, style } = saved;
      saved = null;
      Object.assign(document.body.style, style);
      const html = document.documentElement.style;
      const behaviour = html.scrollBehavior;
      html.scrollBehavior = "auto";
      window.scrollTo(0, y);
      html.scrollBehavior = behaviour;
    };
  }, [active]);
}

/**
 * Swipe down to dismiss. The sheet follows the finger when the swipe starts
 * on its header or while its content is scrolled to the top; a far or quick
 * swipe closes it, a short one springs back. With a mouse, the header
 * (`[data-sheet-grip]`) can be dragged the same way. Touches inside
 * `[data-sheet-nodrag]` (charts that follow the finger) are left alone.
 * `onDismiss` gets the distance already travelled and runs the exit.
 */
export function useDragDismiss(sheet: RefObject<HTMLElement>, scroller: RefObject<HTMLElement>, onDismiss: () => void) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let startY = 0;
    let startX = 0;
    let t0 = 0;
    let dy = 0;
    let tracking = false;
    let dragging = false;

    const begin = (x: number, y: number) => {
      startY = y;
      startX = x;
      t0 = performance.now();
      dy = 0;
      tracking = true;
      dragging = false;
    };
    /** Returns true while the sheet follows the pointer. */
    const follow = (x: number, y: number) => {
      if (!tracking) return false;
      const d = y - startY;
      const dx = x - startX;
      if (!dragging) {
        if (Math.abs(d) < 6 && Math.abs(dx) < 6) return false;
        // Upwards or sideways: an ordinary scroll, not a dismiss.
        if (d <= 0 || Math.abs(dx) > Math.abs(d) || (scroller.current?.scrollTop ?? 0) > 0) {
          tracking = false;
          return false;
        }
        dragging = true;
        el.style.transition = "none";
      }
      // A little resistance, like a rubber band.
      dy = Math.max(0, d) * 0.92;
      el.style.transform = `translateY(${dy}px)`;
      return true;
    };
    const release = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      const speed = dy / Math.max(1, performance.now() - t0);
      if (dy > 120 || (dy > 36 && speed > 0.55)) {
        el.style.transition = "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)";
        el.style.transform = "translateY(110%)";
        el.dataset.dismissing = "";
        window.setTimeout(() => dismiss.current(), 260);
      } else {
        el.style.transition = "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)";
        el.style.transform = "";
      }
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as Element | null;
      if (target?.closest("[data-sheet-nodrag]")) return;
      const sc = scroller.current;
      if (sc && target && sc.contains(target) && sc.scrollTop > 0) return;
      begin(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onMove = (e: TouchEvent) => {
      if (follow(e.touches[0].clientX, e.touches[0].clientY)) e.preventDefault();
    };

    // Mouse: only the header is a handle, so text in the sheet stays selectable.
    const onMouseMove = (e: PointerEvent) => {
      if (follow(e.clientX, e.clientY)) e.preventDefault();
    };
    const onMouseUp = () => {
      window.removeEventListener("pointermove", onMouseMove);
      window.removeEventListener("pointerup", onMouseUp);
      release();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (!(e.target as Element | null)?.closest("[data-sheet-grip]")) return;
      begin(e.clientX, e.clientY);
      window.addEventListener("pointermove", onMouseMove);
      window.addEventListener("pointerup", onMouseUp);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", release);
    el.addEventListener("touchcancel", release);
    el.addEventListener("pointerdown", onPointerDown);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", release);
      el.removeEventListener("touchcancel", release);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onMouseMove);
      window.removeEventListener("pointerup", onMouseUp);
    };
  }, [sheet, scroller]);
}

const PAGE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Slides a sheet out to one side, lets `go` swap its content and brings it
 * back in from the other side (paging between neighbouring items).
 */
export function slideSheet(el: HTMLElement, dir: 1 | -1, go: () => void) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return go();
  const w = el.getBoundingClientRect().width;
  el.style.transition = "transform 0.18s ease-in, opacity 0.18s ease-in";
  el.style.transform = `translateX(${-dir * w * 1.05}px)`;
  el.style.opacity = "0";
  window.setTimeout(() => {
    go();
    el.style.transition = "none";
    el.style.transform = `translateX(${dir * w * 0.6}px)`;
    void el.getBoundingClientRect();
    el.style.transition = `transform 0.4s ${PAGE_EASE}, opacity 0.3s ease-out`;
    el.style.transform = "";
    el.style.opacity = "";
  }, 180);
}

/**
 * Swipe sideways to the next or previous item (the trade card, after Eaves):
 * the sheet follows the finger, a far or quick swipe pages, a short one
 * springs back, and at either end it only gives a little. Vertical swipes
 * stay with scrolling and `useDragDismiss`; charts (`[data-sheet-nodrag]`)
 * keep their own touches.
 */
export function useSwipePager(sheet: RefObject<HTMLElement>, pager: { can: (dir: 1 | -1) => boolean; go: (dir: 1 | -1) => void } | null) {
  const ref = useRef(pager);
  ref.current = pager;

  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let dx = 0;
    let state: "idle" | "track" | "swipe" = "idle";

    const onStart = (e: TouchEvent) => {
      if (!ref.current || e.touches.length !== 1) return;
      if ((e.target as Element | null)?.closest("[data-sheet-nodrag]")) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = performance.now();
      dx = 0;
      state = "track";
    };
    const onMove = (e: TouchEvent) => {
      if (state === "idle") return;
      const x = e.touches[0].clientX - x0;
      const y = e.touches[0].clientY - y0;
      if (state === "track") {
        if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
        if (Math.abs(x) < Math.abs(y) * 1.3) {
          state = "idle";
          return;
        }
        state = "swipe";
        el.style.transition = "none";
      }
      dx = ref.current?.can(x < 0 ? 1 : -1) ? x : x * 0.22;
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(1 - Math.min(0.3, Math.abs(dx) / 1000));
      e.preventDefault();
    };
    const onEnd = () => {
      if (state !== "swipe") {
        state = "idle";
        return;
      }
      state = "idle";
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      const speed = Math.abs(dx) / Math.max(1, performance.now() - t0);
      const p = ref.current;
      if (p?.can(dir) && (Math.abs(dx) > 80 || (Math.abs(dx) > 30 && speed > 0.5))) {
        slideSheet(el, dir, () => p.go(dir));
      } else {
        el.style.transition = `transform 0.35s ${PAGE_EASE}, opacity 0.35s ${PAGE_EASE}`;
        el.style.transform = "";
        el.style.opacity = "";
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [sheet]);
}
