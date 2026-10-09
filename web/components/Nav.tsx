"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Icon, type IconName } from "@/components/Icon";
import { LiquidGlass } from "@/components/LiquidGlass";
import { SearchSheet, useSearchSheet } from "@/components/SearchBox";
import { PORTFOLIO } from "@/lib/features";

// The star (what you follow) took the Portfolio's place on 2026-10-09; the
// Portfolio comes back with `PORTFOLIO` in lib/features.
export const TABS: { href: string; label: string; icon: IconName; fill: IconName }[] = [
  { href: "/", label: "Home", icon: "home", fill: "homeFill" },
  { href: "/discover", label: "Discover", icon: "discovery", fill: "discoveryFill" },
  { href: "/feed", label: "Feed", icon: "notification", fill: "notificationFill" },
  { href: "/watchlist", label: "Watchlist", icon: "star", fill: "starFill" },
  ...(PORTFOLIO ? [{ href: "/me", label: "Portfolio", icon: "graph", fill: "graphFill" } as const] : []),
  { href: "/settings", label: "Settings", icon: "setting", fill: "settingFill" },
];

// Sections that fold into a main tab (tab bar highlight, swipe between tabs).
export function activeTab(path: string): string {
  if (path === "/") return "/";
  if (
    path.startsWith("/discover") ||
    path.startsWith("/portfolio") ||
    path.startsWith("/politicians") ||
    path.startsWith("/politician") ||
    path.startsWith("/investor") ||
    path.startsWith("/stock") ||
    path.startsWith("/insider")
  )
    return "/discover";
  if (path.startsWith("/feed") || path.startsWith("/letter")) return "/feed";
  if (path.startsWith("/watchlist")) return "/watchlist";
  if (path.startsWith("/me")) return "/me";
  if (path.startsWith("/settings")) return "/settings";
  return path;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Tapping the current tab again (iOS: back to the tab's start), e.g. the star tab from its swipe view. */
const tabAgain = (href: string) => window.dispatchEvent(new CustomEvent("outsider:tab-again", { detail: href }));

/**
 * The selection "droplet": one shape that slides and stretches to the active
 * tab instead of each tab lighting up on its own (iOS 26 tab bar).
 */
function useDroplet(active: string, deps: unknown[] = []) {
  const bar = useRef<HTMLDivElement | null>(null);
  const items = useRef(new Map<string, HTMLAnchorElement>());
  const [box, setBox] = useState<{ x: number; w: number; h: number; y: number } | null>(null);
  const measure = useCallback(() => {
    const el = items.current.get(active);
    const host = bar.current;
    if (!el || !host) return setBox(null);
    setBox({ x: el.offsetLeft, w: el.offsetWidth, y: el.offsetTop, h: el.offsetHeight });
  }, [active]);
  useIsoLayoutEffect(measure, [measure, ...deps]);
  useEffect(() => {
    const host = bar.current;
    if (!host) return;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [measure]);
  const register = (href: string) => (node: HTMLAnchorElement | null) => {
    if (node) items.current.set(href, node);
    else items.current.delete(href);
  };
  return { bar, box, register, measure };
}

export function Nav() {
  const path = usePathname() || "/";
  const active = activeTab(path);
  const { bar, box, register } = useDroplet(active);
  return (
    <LiquidGlass as="nav" aria-label="Main navigation" className="hidden rounded-full p-1 md:block">
      <div ref={bar} className="relative flex items-center gap-0.5">
        {box && (
          <span aria-hidden="true" className="glass-droplet" style={{ width: box.w, height: box.h, top: box.y, transform: `translateX(${box.x}px)` }} />
        )}
        {TABS.map((t) => {
          const on = active === t.href;
          return (
            <Link
              key={t.href}
              ref={register(t.href)}
              href={t.href}
              onClick={() => on && tabAgain(t.href)}
              aria-current={on ? "page" : undefined}
              className={`press-sm relative flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[14px] ${on ? "font-semibold text-ink" : "font-medium text-subtle hover:text-ink"}`}
            >
              <Icon name={t.icon} className="h-[18px] w-[18px]" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </LiquidGlass>
  );
}

// Floating liquid-glass tab bar (mobile), in the manner of the reference
// wallet app (Fuse): solid glyphs without labels, the gear for Settings
// last, the current tab in full ink and the others in a soft grey, and a
// small pop when a tab becomes current. Like iOS, it tightens while you
// scroll down to read and relaxes when you scroll back up. Beside it, as in
// iOS 26, a round glass loupe opens the search (it replaced the "+" menu,
// user, 2026-10-09).
export function BottomNav() {
  const path = usePathname() || "/";
  const active = activeTab(path);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setCompact(y > last && y > 120);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setCompact(false), [path]);
  const search = useSearchSheet();
  const openSearch = () => {
    // Open and focus in the same tap, or iOS keeps the keyboard down.
    flushSync(() => search.setOpen(true));
    search.field.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <div aria-hidden="true" className="scroll-edge-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20 h-28 md:hidden" />
      {/* Tab capsule on the left, the round action button on the right. */}
      <div style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }} className="fixed inset-x-0 bottom-4 z-30 flex items-end justify-between gap-3 px-4 md:hidden">
        <nav aria-label="Main navigation" className="min-w-0">
          <LiquidGlass radius={999} className={`rounded-full transition-[padding] duration-500 ease-spring ${compact ? "px-1.5 py-1" : "px-2 py-1.5"}`}>
            <div className="flex items-center">
              {TABS.map((t) => {
                const on = active === t.href;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    onClick={() => on && tabAgain(t.href)}
                    aria-current={on ? "page" : undefined}
                    aria-label={t.label}
                    className={`press-sm flex items-center justify-center rounded-full transition-[width,height,color] duration-500 ease-spring ${compact ? "h-10 w-11" : "h-11 w-[3.05rem]"} ${on ? "text-ink" : "text-ink/30 hover:text-ink/50"}`}
                  >
                    <Icon key={on ? "on" : "off"} name={t.fill} className={`h-[25px] w-[25px] ${on ? "tab-pop" : ""}`} />
                  </Link>
                );
              })}
            </div>
          </LiquidGlass>
        </nav>
        <LiquidGlass radius={999} className="shrink-0 rounded-full">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search"
            aria-expanded={search.open}
            className={`press-sm flex items-center justify-center rounded-full text-ink transition-[width,height] duration-500 ease-spring ${compact ? "h-12 w-12" : "h-14 w-14"}`}
          >
            <Icon name="search" className="h-[25px] w-[25px]" />
          </button>
        </LiquidGlass>
      </div>
      <SearchSheet sheet={search} />
    </>
  );
}
