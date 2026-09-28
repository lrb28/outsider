"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import type { AuraKind } from "@/lib/format";

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
  const measure = useCallback(() => {
    const el = buttons.current.get(value);
    setBox(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
  }, [value]);
  useIsoLayoutEffect(measure, [measure]);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  const h = size === "sm" ? "min-h-8 px-3 text-[13px]" : "min-h-9 px-4 text-[14px]";
  return (
    <div
      ref={track}
      role="tablist"
      aria-label={label}
      className={`no-scrollbar relative flex w-fit max-w-full overflow-x-auto rounded-full bg-surface2 p-[3px] ${className}`}
    >
      {box && (
        <span
          aria-hidden="true"
          className="absolute bottom-[3px] top-[3px] rounded-full bg-card shadow-[0_1px_3px_rgb(0_0_0/0.1),0_0_0_0.5px_rgb(0_0_0/0.04)] transition-[transform,width] duration-500 ease-spring"
          style={{ width: box.w, transform: `translateX(${box.x - 3}px)`, left: 3 }}
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

/** Section header: title left, optional "Alle" link right. */
export function SectionHeader({ title, href, more = "Alle", children }: { title: string; href?: string; more?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">{title}</h2>
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
    <div className="group relative flex items-center pr-2 after:absolute after:bottom-0 after:left-[4.25rem] after:right-0 after:h-px after:bg-hair last:after:hidden">
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
        <div className="flex items-center gap-1 font-display text-[19px] font-bold tracking-[-0.02em]">
          {title} <Icon name="chevronRight" className="h-4 w-4 text-subtle" />
        </div>
        <p className="mt-1 text-[14px] leading-snug text-subtle">{blurb}</p>
      </div>
    </Link>
  );
}

const PARTY: Record<string, string> = { D: "Demokraten", R: "Republikaner", I: "Unabhängig", Democrat: "Demokraten", Republican: "Republikaner" };

/** "Demokraten · CA-11" */
export function politicianLine(party: string | null | undefined, seat: string | null | undefined): string {
  return [party ? PARTY[party] ?? party : null, seat].filter(Boolean).join(" · ") || "US-Repräsentantenhaus";
}

/** Round glass back button (iOS 26 navigation bar), label for assistive tech. */
export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={`Zurück zu ${label}`} title={label} className="btn-capsule !h-11 !w-11 !min-h-0 !p-0">
      <Icon name="chevronLeft" className="h-5 w-5" />
    </Link>
  );
}

/** Key figures in one card, separated by hairlines; scales down on phones. */
export function StatRow({ items }: { items: { label: string; value: ReactNode; cls?: string }[] }) {
  const cols = items.length === 4 ? "grid-cols-2 sm:grid-cols-4" : items.length === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`card grid ${cols} overflow-hidden`}>
      {items.map((s, i) => (
        <div key={s.label} className={`min-w-0 px-3 py-3.5 sm:px-5 sm:py-4 ${i > 0 ? "border-l border-hair" : ""} ${items.length === 4 && i === 2 ? "max-sm:border-l-0 max-sm:border-t" : ""} ${items.length === 4 && i === 3 ? "max-sm:border-t" : ""}`}>
          <div className={`truncate font-display text-[19px] font-bold leading-tight tracking-[-0.02em] tabular-nums sm:text-[24px] ${s.cls ?? ""}`}>{s.value}</div>
          <div className="mt-1 truncate text-[12px] text-subtle sm:text-[13px]">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
