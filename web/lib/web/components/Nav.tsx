"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, JSX.Element> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  discover: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  ),
  feed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  ),
  depot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M21 12A9 9 0 1 1 12 3" />
      <path d="M12 3a9 9 0 0 1 9 9h-9z" />
    </svg>
  ),
};

const TABS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/discover", label: "Discover", icon: "discover" },
  { href: "/feed", label: "Feed", icon: "feed" },
  { href: "/me", label: "Depot", icon: "depot" },
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
    <nav className="hidden items-center gap-1 rounded-full bg-white/70 p-1 ring-1 ring-black/5 backdrop-blur md:flex">
      {TABS.map((t) => {
        const on = active === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`press-sm flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${
              on
                ? "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                : "text-subtle hover:bg-white hover:text-ink"
            }`}
          >
            {ICONS[t.icon]}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Floating app-style bottom bar (mobile only).
export function BottomNav() {
  const path = usePathname() || "/";
  const active = activeTab(path);
  return (
    <nav className="fixed inset-x-0 bottom-4 z-30 flex justify-center md:hidden">
      <div className="flex items-center gap-1 rounded-full bg-white/85 p-1.5 shadow-cardhover ring-1 ring-black/10 backdrop-blur-xl">
        {TABS.map((t) => {
          const on = active === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`press-sm flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 ${
                on
                  ? "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : "text-subtle"
              }`}
            >
              {ICONS[t.icon]}
              <span className="text-[10px] font-medium leading-none">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
