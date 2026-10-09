"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { logoBackdrop } from "@/components/CompanyLogo";
import { Wordmark } from "@/components/Wordmark";
import { fetchJson } from "@/lib/fetchJson";
import { fixTicker } from "@/lib/format";
import { haptic } from "@/lib/haptic";
import type { SpotlightData, SpotlightItem } from "@/lib/types";

// Pull distance (after resistance) that triggers a refresh, and where the
// page rests while it runs. Both are measured below the safe area.
const THRESHOLD = 124;
const HOLD = 172;
// The rounded top edge of the page as it slides down.
const LIP = 26;
// The stock stays up at least this long, so the reveal can be seen.
const MIN_SHOW = 1100;
const MAX_WAIT = 8000;
const SETTLE_MS = 520;
const KEY = "outsider:spotlight";

type Slot = { item: SpotlightItem; src: string; color: string; dark: boolean };
type Phase = "idle" | "armed" | "refreshing";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function storedIndex() {
  try {
    return Math.max(0, Number(window.localStorage.getItem(KEY)) || 0);
  } catch {
    return 0;
  }
}

/**
 * Pull to refresh for My portfolio. Pulling the page down at the top slides it
 * over a panel painted in one stock's own colours — NVIDIA green with the
 * NVIDIA logo, Apple black, Microsoft white — that says why the stock is
 * worth a look: most bought by the star investors, what Buffett holds or
 * buys, most held, what insiders buy (/api/spotlight). Each refresh moves on
 * to the next stock. Releasing past the threshold reloads the live prices.
 *
 * Touch only; the page's own sideways swipe (SwipeNav) is left alone because
 * this only takes mostly vertical, downward pulls that start at the very top.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [items, setItems] = useState<SpotlightItem[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [done, setDone] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGRectElement>(null);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  const index = useRef(0);

  useEffect(() => {
    setHost(document.body);
    index.current = storedIndex();
    let on = true;
    fetchJson<SpotlightData>("/api/spotlight", { tries: 1 })
      .then((d) => on && setItems(d.items ?? []))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  /** Shows the first stock from `start` on whose logo loads. */
  const prepare = useCallback(
    async (start: number) => {
      const n = items.length;
      for (let k = 0; k < n; k++) {
        const i = (start + k) % n;
        const item = items[i];
        const look = await logoBackdrop(fixTicker(item.ticker, item.company) ?? item.ticker, 256);
        if (!look) continue;
        index.current = i;
        try {
          window.localStorage.setItem(KEY, String(i));
        } catch {
          /* private mode: start over next visit */
        }
        setSlot({ item, ...look });
        return;
      }
      setSlot(null);
    },
    [items],
  );

  useEffect(() => {
    if (items.length) void prepare(index.current % items.length);
  }, [items, prepare]);

  // The gesture. Writes straight to the DOM while the finger moves; React
  // only hears about the threshold and the refresh.
  useEffect(() => {
    const root = document.documentElement;
    let state: "idle" | "maybe" | "pull" | "busy" = "idle";
    let x0 = 0;
    let y0 = 0;
    let y = 0;
    let armed = false;
    let safe = 0;
    let movers: HTMLElement[] = [];

    const measureSafe = () => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
      safe = probe.offsetHeight;
      probe.remove();
    };

    const blocked = (target: Element | null) => {
      if (!target) return true;
      if (target.closest("[data-sheet-nodrag], input, textarea, select, [contenteditable='true']")) return true;
      // A sheet, a dialog or the welcome screen is open.
      if (document.querySelector("dialog[open]") || document.body.style.position === "fixed" || root.style.overflow === "hidden") return true;
      for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
        if (getComputedStyle(el).touchAction === "none") return true;
      }
      return false;
    };

    const draw = (px: number) => {
      y = px;
      root.style.setProperty("--ptr-y", `${px}px`);
      const p = Math.min(1, Math.max(0, (px - safe) / THRESHOLD));
      panel.current?.style.setProperty("--ptr-p", String(p));
      if (ring.current) ring.current.style.strokeDashoffset = String(100 - p * 100);
    };

    const begin = () => {
      measureSafe();
      // Everything in the page's flow moves; fixed layers (tab bar) stay.
      movers = Array.from(document.body.children).filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && !el.hasAttribute("data-ptr-panel") && el.tagName !== "SCRIPT" && getComputedStyle(el).position !== "fixed",
      );
      for (const el of movers) el.setAttribute("data-ptr-move", "");
      root.setAttribute("data-ptr", "drag");
      draw(0);
    };

    const end = () => {
      for (const el of movers) el.removeAttribute("data-ptr-move");
      movers = [];
      root.removeAttribute("data-ptr");
      root.style.removeProperty("--ptr-y");
      state = "idle";
    };

    const settle = (to: number) => {
      root.setAttribute("data-ptr", "settle");
      draw(to);
    };

    // Follows the finger at three quarters of its travel, then resists.
    const rubber = (dy: number) => {
      const k = Math.min(1, (THRESHOLD + safe) / 160);
      const v = dy * k;
      const soft = HOLD + safe;
      return v <= soft ? v : soft + 90 * (1 - 1 / (1 + (v - soft) / 90));
    };

    const onStart = (e: TouchEvent) => {
      if (state === "busy" || e.touches.length !== 1) return;
      state = "idle";
      if (window.scrollY > 0 || blocked(e.target as Element)) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      state = "maybe";
    };

    const onMove = (e: TouchEvent) => {
      if (state !== "maybe" && state !== "pull") return;
      const t = e.touches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (state === "maybe") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Downwards and mostly vertical, from the very top; anything else
        // is a scroll or a sideways swipe.
        if (dy <= 0 || Math.abs(dy) < Math.abs(dx) * 1.2 || window.scrollY > 0) {
          state = "idle";
          return;
        }
        state = "pull";
        begin();
      }
      // Keeps the browser's own bounce and pull-to-reload out of it.
      if (e.cancelable) e.preventDefault();
      draw(rubber(Math.max(0, dy)));
      const past = y - safe >= THRESHOLD;
      if (past !== armed) {
        armed = past;
        if (past) haptic();
        setPhase(past ? "armed" : "idle");
      }
    };

    const onEnd = async () => {
      if (state === "maybe") state = "idle";
      if (state !== "pull") return;
      if (!armed) {
        state = "busy";
        settle(0);
        await sleep(SETTLE_MS);
        setPhase("idle");
        end();
        return;
      }
      state = "busy";
      armed = false;
      setPhase("refreshing");
      settle(HOLD + safe);
      await Promise.all([
        Promise.race([refresh.current().catch(() => {}), sleep(MAX_WAIT)]),
        sleep(MIN_SHOW),
      ]);
      settle(0);
      await sleep(SETTLE_MS);
      setPhase("idle");
      setDone((n) => n + 1);
      end();
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
      end();
    };
  }, []);

  // After each refresh the next stock waits behind the page.
  useEffect(() => {
    if (done && items.length) void prepare(index.current + 1);
  }, [done, items.length, prepare]);

  if (!host) return null;

  const bg = slot?.color ?? "rgb(var(--ink))";
  const fg = slot ? (slot.dark ? "#fff" : "rgb(29 29 31)") : "rgb(var(--bg))";

  return createPortal(
    <>
      <div
        ref={panel}
        data-ptr-panel=""
        aria-hidden="true"
        className="ptr-panel pointer-events-none fixed inset-x-0 top-0 z-10 overflow-hidden"
        style={{ background: bg, color: fg }}
      >
        <div className="ptr-stage absolute inset-x-0 top-0 flex flex-col items-center justify-center px-6 text-center">
          <div className={`ptr-logo relative ${phase === "armed" ? "ptr-pop" : ""}`}>
            {slot ? (
              <img src={slot.src} alt="" draggable={false} className="h-[68px] w-[68px] rounded-[22%] object-cover" />
            ) : (
              <span className="flex h-[68px] w-[68px] items-center justify-center">
                <Wordmark height={15} />
              </span>
            )}
            <svg viewBox="0 0 88 88" className="absolute -inset-[10px] h-[88px] w-[88px] overflow-visible" fill="none">
              <rect
                ref={ring}
                x="2"
                y="2"
                width="84"
                height="84"
                rx="24"
                pathLength={100}
                stroke="currentColor"
                strokeOpacity={0.55}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray={phase === "refreshing" ? "24 76" : "100 100"}
                className={phase === "refreshing" ? "ptr-spin" : ""}
              />
            </svg>
          </div>
          {slot && (
            <div className="ptr-text mt-3.5 max-w-full">
              <div className="truncate text-[13px] font-medium opacity-70">{slot.item.label}</div>
              <div className="mt-0.5 truncate text-[20px] font-bold leading-tight tracking-[-0.01em]">{slot.item.company}</div>
              <div className="mt-0.5 truncate text-[13px] tabular-nums opacity-80">{slot.item.metric}</div>
            </div>
          )}
        </div>
        <div className="ptr-lip absolute inset-x-0 bottom-0 rounded-t-[26px] bg-canvas" style={{ height: LIP }} />
      </div>
      <div role="status" className="sr-only">{done ? "Portfolio refreshed" : ""}</div>
    </>,
    host,
  );
}
