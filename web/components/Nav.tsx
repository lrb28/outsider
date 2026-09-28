"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { LiquidGlass, refreshLiquidGlass } from "@/components/LiquidGlass";

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

// The active tab: a brighter glass drop inside the bar, never a colour fill,
// so the navigation stays calm and the content leads (Apple HIG).
const ACTIVE = "bg-white/80 text-ink shadow-[inset_0_1px_0_#fff,0_2px_10px_rgb(28_28_30/0.12)]";

export function Nav() {
  const path = usePathname() || "/";
  const active = activeTab(path);
  useEffect(() => refreshLiquidGlass(), [path]);
  return (
    <LiquidGlass as="nav" aria-label="Hauptnavigation" radius={999} tint={0.42} blur={9} className="hidden items-center gap-1 rounded-full p-1 md:flex">
      {TABS.map((t) => {
        const on = active === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`press-sm flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm ${on ? `${ACTIVE} font-semibold` : "font-medium text-subtle hover:text-ink"}`}
          >
            <Icon name={t.icon} className="h-[18px] w-[18px]" />
            {t.label}
          </Link>
        );
      })}
    </LiquidGlass>
  );
}

// Floating liquid-glass tab bar (mobile). Like iOS, it minimises while you
// scroll down to read and comes back as soon as you scroll up.
export function BottomNav() {
  const path = usePathname() || "/";
  const active = activeTab(path);
  const [compact, setCompact] = useState(false);
  useEffect(() => refreshLiquidGlass(), [path]);
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
      <div aria-hidden="true" data-liquid-glass-skip="" className="scroll-edge-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20 h-28 md:hidden" />
      <nav aria-label="Mobile Hauptnavigation" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }} className="fixed inset-x-0 bottom-4 z-30 flex justify-center md:hidden">
        <LiquidGlass radius={999} tint={0.46} blur={9} className={`flex items-center rounded-full transition-all duration-300 ease-out ${compact ? "gap-0 p-1" : "gap-0.5 p-1.5"}`}>
          {TABS.map((t) => {
            const on = active === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? "page" : undefined}
                aria-label={t.label}
                className={`press-sm flex flex-col items-center rounded-full transition-all duration-300 ease-out ${compact ? "min-w-[3rem] gap-0 px-2.5 py-2" : "min-w-[4.25rem] gap-0.5 px-3 py-1.5"} ${on ? ACTIVE : "text-subtle"}`}
              >
                <Icon name={t.icon} className="h-[22px] w-[22px]" />
                <span aria-hidden="true" className={`overflow-hidden text-[10px] leading-none transition-all duration-300 ${compact ? "max-h-0 opacity-0" : "max-h-4 opacity-100"} ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
              </Link>
            );
          })}
        </LiquidGlass>
      </nav>
    </>
  );
}
