"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/feed", label: "Feed" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/politicians", label: "Politiker" },
];

export function Nav() {
  const path = usePathname() || "/";
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const active = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-brand text-white shadow-card"
                : "text-subtle hover:bg-slate-100 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
