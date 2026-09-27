"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/Icon";

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

export function Nav() {
  const path = usePathname() || "/";
  const active = activeTab(path);
  return (
    <nav aria-label="Hauptnavigation" className="glass hidden items-center gap-1 rounded-full p-1 md:flex">
      {TABS.map((t) => {
        const on = active === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`press-sm flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${
              on ? "btn-primary !px-3.5 !py-1.5" : "text-subtle hover:bg-white/70 hover:text-ink"
            }`}
          >
            <Icon name={t.icon} className="h-[18px] w-[18px]" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Floating liquid-glass tab bar (mobile only). The active tab sits in a
// brighter glass capsule, like the iOS tab bar.
export function BottomNav() {
  const path = usePathname() || "/";
  const active = activeTab(path);
  return (
    <nav aria-label="Mobile Hauptnavigation" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }} className="fixed inset-x-0 bottom-4 z-30 flex justify-center md:hidden">
      <div className="glass flex items-center gap-0.5 rounded-full p-1.5">
        {TABS.map((t) => {
          const on = active === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`press-sm flex min-w-[4.25rem] flex-col items-center gap-0.5 rounded-full px-3 py-1.5 ${
                on
                  ? "bg-white/90 text-ink shadow-[inset_0_1px_0_rgb(255_255_255),0_2px_10px_rgb(28_28_30/0.12)]"
                  : "text-subtle"
              }`}
            >
              <Icon name={t.icon} className="h-[22px] w-[22px]" />
              <span className={`text-[10px] leading-none ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
