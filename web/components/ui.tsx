"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import type { AuraKind } from "@/lib/format";
import { useSwipeTabs } from "@/lib/swipeTabs";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * iOS segmented control. The selected segment is one "droplet" that slides
 * to the new position rather than a colour jump.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const readEdges = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);
  const measure = useCallback(() => {
    const el = buttons.current.get(value);
    setBox(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    readEdges();
  }, [value, readEdges]);
  useIsoLayoutEffect(measure, [measure]);
  // When the tabs overflow (seven Depot tabs on a phone), the chosen one is
  // scrolled into view; otherwise the selection could sit off screen.
  useEffect(() => {
    const el = buttons.current.get(value);
    const host = track.current;
    if (!el || !host || host.scrollWidth <= host.clientWidth) return;
    const left = el.offsetLeft - (host.clientWidth - el.offsetWidth) / 2;
    host.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [value]);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  const h = size === "sm" ? "min-h-8 px-3 text-[13px]" : "min-h-9 px-4 text-[14px]";
  const fade = edges.left || edges.right
    ? `linear-gradient(90deg, ${edges.left ? "transparent, #000 28px" : "#000"}, ${edges.right ? "#000 calc(100% - 28px), transparent" : "#000"})`
    : undefined;
  return (
    <div
      ref={track}
      role="tablist"
      aria-label={label}
      onScroll={readEdges}
      style={fade ? { WebkitMaskImage: fade, maskImage: fade } : undefined}
      className={`no-scrollbar relative flex w-fit max-w-full overflow-x-auto rounded-full bg-surface2 p-[3px] ${className}`}
    >
      {box && (
        <span
          aria-hidden="true"
          className="absolute bottom-[3px] top-[3px] rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)] transition-[transform,width] duration-500 ease-spring"
          style={{ width: box.w, transform: `translateX(${box.x - 3}px)`, left: 3, background: "rgb(var(--seg-thumb))" }}
        />
      )}
      {options.map(([key, text]) => {
        const on = key === value;
        return (
          <button
            key={key}
            ref={(node) => {
              if (node) buttons.current.set(key, node);
              else buttons.current.delete(key);
            }}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(key)}
            className={`relative shrink-0 whitespace-nowrap rounded-full !min-h-0 transition-colors duration-300 ${h} ${on ? "font-semibold text-ink" : "font-medium text-subtle hover:text-ink"}`}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Chip bar for the sections and filters at the top of a page (Entdecken,
 * Meldungen, Depot): capsules on a quiet fill, the chosen one solid. People
 * categories carry their aura dot. One style everywhere, so switching a
 * section looks the same on every tab. The visible chip is 36 px, the tap
 * target 44 px. Scrolls sideways with soft edges when it does not fit.
 */
export function ChipBar<T extends string>({
  items,
  value,
  onChange,
  label,
  mode = "tabs",
  swipe = true,
  className = "",
}: {
  items: readonly { key: T; label: string; aura?: AuraKind | null; count?: number | null }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** "tabs" switches sections (tablist), "filter" narrows a list (toggle buttons). */
  mode?: "tabs" | "filter";
  /** Swiping the page sideways steps through these chips. */
  swipe?: boolean;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  useSwipeTabs(items.map((it) => it.key), value, onChange as (key: string) => void, swipe);
  const chips = useRef(new Map<T, HTMLButtonElement>());
  const [edges, setEdges] = useState({ left: false, right: false });
  const readEdges = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);
  useIsoLayoutEffect(readEdges, [readEdges, items.length]);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(readEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [readEdges]);
  // The chosen chip is brought into view when the bar scrolls.
  useEffect(() => {
    const el = chips.current.get(value);
    const host = track.current;
    if (!el || !host || host.scrollWidth <= host.clientWidth) return;
    const left = el.offsetLeft - (host.clientWidth - el.offsetWidth) / 2;
    host.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [value]);
  const fade = edges.left || edges.right
    ? `linear-gradient(90deg, ${edges.left ? "transparent, #000 24px" : "#000"}, ${edges.right ? "#000 calc(100% - 24px), transparent" : "#000"})`
    : undefined;
  return (
    <div
      ref={track}
      role={mode === "tabs" ? "tablist" : "group"}
      aria-label={label}
      onScroll={readEdges}
      style={fade ? { WebkitMaskImage: fade, maskImage: fade } : undefined}
      className={`no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 ${className}`}
    >
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button
            key={it.key}
            ref={(node) => {
              if (node) chips.current.set(it.key, node);
              else chips.current.delete(it.key);
            }}
            type="button"
            role={mode === "tabs" ? "tab" : undefined}
            aria-selected={mode === "tabs" ? on : undefined}
            aria-pressed={mode === "filter" ? on : undefined}
            onClick={() => onChange(it.key)}
            className="group flex shrink-0 items-center"
          >
            <span
              className={`inline-flex h-9 items-center gap-[5px] whitespace-nowrap rounded-full px-3 text-[13.5px] transition-[background-color,color,transform,box-shadow] duration-300 ease-spring group-active:scale-95 ${
                on
                  ? "bg-brand font-semibold text-on-brand shadow-[0_2px_8px_rgb(0_0_0/0.14)]"
                  : "bg-surface2 font-medium text-subtle group-hover:text-ink"
              }`}
            >
              {it.aura && <i aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: `rgb(var(--aura-${it.aura}))` }} />}
              {it.label}
              {it.count != null && <span className={`tabular-nums ${on ? "opacity-70" : "opacity-60"}`}>{it.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Page title block (HIG large title) with an optional line below. */
export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="fade-up flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="large-title">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-xl text-[15px] leading-snug text-subtle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Section header: title left, optional "See all" link right. */
export function SectionHeader({ title, href, more = "See all", children }: { title: string; href?: string; more?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">{title}</h2>
      {children}
      {href && (
        <Link href={href} className="inline-flex min-h-11 items-center gap-0.5 text-[15px] font-medium text-subtle hover:text-ink">
          {more}
          <Icon name="chevronRight" className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/** Grouped inset list (iOS): one card, hairlines inset from the leading edge. */
export function ListCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card overflow-hidden ${className}`}>{children}</div>;
}

export function ListRow({
  href,
  leading,
  title,
  subtitle,
  trailing,
  after,
  chevron = true,
}: {
  href: string;
  leading: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** Rendered outside the link, e.g. a follow star. */
  after?: ReactNode;
  chevron?: boolean;
}) {
  return (
    <div className="cv-row group relative flex items-center pr-2 after:absolute after:bottom-0 after:left-[4.25rem] after:right-0 after:h-px after:bg-hair last:after:hidden">
      <Link href={href} className="flex min-h-[3.75rem] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-2 transition-colors hover:bg-ink/[0.03] active:bg-ink/[0.06]">
        {leading}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight">{title}</div>
          {subtitle && <div className="mt-0.5 truncate text-[13px] text-subtle">{subtitle}</div>}
        </div>
        {trailing && <div className="shrink-0 text-right">{trailing}</div>}
        {chevron && <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-muted" />}
      </Link>
      {after}
    </div>
  );
}

/** Empty state (ContentUnavailableView). */
export function EmptyState({ icon = "info", title, children }: { icon?: Parameters<typeof Icon>[0]["name"]; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <span className="icon-ring h-12 w-12"><Icon name={icon} className="h-6 w-6 text-subtle" /></span>
      <div className="mt-3 text-[17px] font-semibold">{title}</div>
      {children && <div className="mt-1 max-w-sm text-[15px] leading-snug text-subtle">{children}</div>}
    </div>
  );
}

/**
 * A card with a soft glow in the colour of its aura, top-left. Used for the
 * entry points on Start and Entdecken.
 */
export function AuraCard({
  href,
  aura,
  title,
  blurb,
  visual,
  className = "",
}: {
  href: string;
  aura: AuraKind | "neutral";
  title: string;
  blurb: string;
  visual: ReactNode;
  className?: string;
}) {
  const glow =
    aura === "neutral"
      ? "radial-gradient(90% 80% at 0% 0%, rgb(var(--ink) / 0.06), transparent 70%)"
      : `radial-gradient(90% 80% at 0% 0%, rgb(var(--aura-${aura}) / 0.2), transparent 70%), radial-gradient(60% 60% at 100% 0%, rgb(var(--aura-${aura}) / 0.08), transparent 70%)`;
  return (
    <Link href={href} className={`card lcard-hover press relative flex flex-col justify-between overflow-hidden p-5 ${className}`}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: glow }} />
      <div className="relative">{visual}</div>
      <div className="relative mt-6">
        <div className="flex items-center gap-1 font-display text-[19px] font-bold tracking-[-0.01em]">
          {title} <Icon name="chevronRight" className="h-4 w-4 text-subtle" />
        </div>
        <p className="mt-1 text-[14px] leading-snug text-subtle">{blurb}</p>
      </div>
    </Link>
  );
}

const PARTY: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent", Democrat: "Democrat", Republican: "Republican" };

/** "Democrat · CA-11" */
export function politicianLine(party: string | null | undefined, seat: string | null | undefined): string {
  return [party ? PARTY[party] ?? party : null, seat].filter(Boolean).join(" · ") || "US House of Representatives";
}

/** Round glass back button (iOS 26 navigation bar), label for assistive tech. */
export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={`Back to ${label}`} title={label} className="btn-capsule !h-11 !w-11 !min-h-0 !p-0">
      <Icon name="chevronLeft" className="h-5 w-5" />
    </Link>
  );
}

/** Key figures in one card, separated by hairlines. Each cell is a size
 *  container, so a value shrinks with its column on narrow phones instead of
 *  being cut off. A cell with `onClick` is a button (chevron top right) that
 *  shows what is behind the number. */
export function StatRow({ items }: { items: { label: string; value: ReactNode; cls?: string; onClick?: () => void; hint?: string }[] }) {
  const cols = items.length === 4 ? "grid-cols-2 sm:grid-cols-4" : items.length === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`card grid ${cols} overflow-hidden`}>
      {items.map((s, i) => {
        const cell = `relative min-w-0 [container-type:inline-size] px-3 py-3.5 text-left sm:px-5 sm:py-4 ${i > 0 ? "border-l border-hair" : ""} ${items.length === 4 && i === 2 ? "max-sm:border-l-0 max-sm:border-t" : ""} ${items.length === 4 && i === 3 ? "max-sm:border-t" : ""}`;
        const body = (
          <>
            <div className={`truncate ${s.onClick ? "pr-4" : ""} font-display text-[clamp(14px,18cqi,19px)] font-bold leading-tight tracking-[-0.01em] tabular-nums sm:text-[clamp(14px,18cqi,24px)] ${s.cls ?? ""}`}>{s.value}</div>
            <div className="mt-1 text-[12px] leading-snug text-subtle sm:text-[13px]">{s.label}</div>
          </>
        );
        return s.onClick ? (
          <button key={s.label} type="button" onClick={s.onClick} aria-label={s.hint ?? `Show ${s.label.toLowerCase()}`} className={`${cell} group transition-colors hover:bg-ink/[0.03] active:bg-ink/[0.06]`}>
            {body}
            <Icon name="chevronRight" className="absolute right-2 top-3.5 h-4 w-4 text-muted transition-transform duration-300 ease-spring group-hover:translate-x-0.5 sm:right-3 sm:top-4" />
          </button>
        ) : (
          <div key={s.label} className={cell}>{body}</div>
        );
      })}
    </div>
  );
}

/** Navigation row of a detail page: round back button left, action right. */
export function DetailTopBar({ back, label, action }: { back: string; label: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <BackButton href={back} label={label} />
      {action}
    </div>
  );
}
