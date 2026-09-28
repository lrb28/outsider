"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";

/*
 * The round "+" menu button beside the tab bar (from the reference wallet
 * app): it opens a short stack of actions above a blurred page, each with a
 * coloured icon, right-aligned towards the thumb. Escape, a tap outside or
 * any navigation closes it.
 */

type Action = { label: string; icon: IconName; colour: string; href?: string; run?: () => void };

export const openSearch = () => window.dispatchEvent(new CustomEvent("aura:search"));

const ACTIONS: Action[] = [
  { label: "Suchen", icon: "search", colour: "var(--ink)", run: openSearch },
  { label: "Insider-Käufe", icon: "work", colour: "var(--aura-insider)", href: "/discover/insiderbuys" },
  { label: "Politiker-Trades", icon: "people", colour: "var(--aura-politician)", href: "/feed?type=politician" },
  { label: "Folgen einrichten", icon: "star", colour: "var(--aura-investor)", href: "/?willkommen=folgen" },
  { label: "Mein Depot", icon: "wallet", colour: "var(--bull-fill)", href: "/me" },
];

export function ActionMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fade-in fixed inset-0 z-30 bg-canvas/55 backdrop-blur-xl [animation-delay:0ms] [animation-duration:250ms]"
        />
      )}
      <div className="relative z-40">
        {open && (
          <ul id="action-menu" role="menu" aria-label="Aktionen" className="absolute bottom-[calc(100%+1.25rem)] right-1 flex flex-col items-end gap-5">
            {ACTIONS.map((a, i) => {
              const body = (
                <>
                  <span className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{a.label}</span>
                  <span className="flex h-7 w-7 items-center justify-center" style={{ color: `rgb(${a.colour})` }}>
                    <Icon name={a.icon} className="h-7 w-7" />
                  </span>
                </>
              );
              const cls = "press flex min-h-11 items-center gap-3 whitespace-nowrap";
              return (
                <li key={a.label} role="none" className="action-item" style={{ animationDelay: `${(ACTIONS.length - 1 - i) * 35}ms` }}>
                  {a.href ? (
                    <Link role="menuitem" href={a.href} className={cls} onClick={() => setOpen(false)}>{body}</Link>
                  ) : (
                    <button role="menuitem" className={`${cls} !min-h-11`} onClick={() => { setOpen(false); a.run?.(); }}>{body}</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <button
          ref={button}
          aria-label={open ? "Aktionen schließen" : "Aktionen"}
          aria-expanded={open}
          aria-controls="action-menu"
          onClick={() => setOpen((o) => !o)}
          className={`press-sm flex items-center justify-center rounded-full bg-brand text-on-brand shadow-[0_8px_24px_rgb(0_0_0/0.22)] transition-[width,height] duration-500 ease-spring ${compact ? "h-12 w-12" : "h-14 w-14"}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-6 w-6 transition-transform duration-500 ease-spring ${open ? "rotate-45" : ""}`}>
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </>
  );
}
