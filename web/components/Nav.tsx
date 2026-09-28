"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { ActionMenu } from "@/components/ActionMenu";
import { Icon, type IconName } from "@/components/Icon";
import { LiquidGlass } from "@/components/LiquidGlass";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Start", icon: "home" },
  { href: "/discover", label: "Entdecken", icon: "discovery" },
  { href: "/feed", label: "Meldungen", icon: "notification" },
  { href: "/me", label: "Depot", icon: "graph" },
];

// Sections that fold into a main tab for highlighting purposes.
function activeTab(path: string): string {
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
  if (path.startsWith("/feed")) return "/feed";
  if (path.startsWith("/me")) return "/me";
  return path;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
    <LiquidGlass as="nav" aria-label="Hauptnavigation" className="hidden rounded-full p-1 md:block">
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

// Floating liquid-glass tab bar (mobile). Like iOS, it minimises while you
// scroll down to read and comes back as soon as you scroll up.
export function BottomNav() {
  const path = usePathname() || "/";
  const active = activeTab(path);
  const [compact, setCompact] = useState(false);
  const { bar, box, register, measure } = useDroplet(active, [compact]);
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
  return (
    <>
      <div aria-hidden="true" className="scroll-edge-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20 h-28 md:hidden" />
      {/* Tab capsule on the left, the round action button on the right. */}
      <div style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }} className="fixed inset-x-0 bottom-4 z-30 flex items-end justify-between gap-3 px-4 md:hidden">
      <nav aria-label="Mobile Hauptnavigation" className="min-w-0">
        <LiquidGlass radius={999} className={`rounded-full transition-[padding] duration-500 ease-spring ${compact ? "p-1" : "p-1.5"}`}>
          <div ref={bar} onTransitionEnd={measure} className="relative flex items-center gap-0.5">
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
                  aria-current={on ? "page" : undefined}
                  aria-label={t.label}
                  className={`press-sm relative flex flex-col items-center rounded-full transition-[padding,min-width,color] duration-500 ease-spring ${compact ? "min-w-[2.9rem] gap-0 px-2.5 py-2" : "min-w-[3.9rem] gap-0.5 px-2.5 py-1.5"} ${on ? "text-ink" : "text-subtle"}`}
                >
                  <Icon name={t.icon} className="h-[22px] w-[22px]" />
                  <span aria-hidden="true" className={`overflow-hidden text-[10px] leading-none transition-all duration-300 ${compact ? "max-h-0 opacity-0" : "max-h-4 opacity-100"} ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
                </Link>
              );
            })}
          </div>
        </LiquidGlass>
      </nav>
      <ActionMenu compact={compact} />
      </div>
    </>
  );
}
