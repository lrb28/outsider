"use client";

import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/CompanyLogo";
import { type AuraKind, initials, wikiTitleFor } from "@/lib/format";
import { FUND_LOGOS, PORTRAITS } from "@/lib/portraits";

/** Deterministic 0..1 from a name, so each monogram keeps its own glow. */
function seed(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * A person's picture: an explicit photo (official congressional portrait),
 * else a credited free portrait for known investors, else their fund's logo,
 * for insiders the logo of their company, and only then an aura monogram —
 * initials on a soft glow in the colour of the group (investors blue,
 * insiders orange, politicians magenta). No borders or rings.
 */
export function Avatar({
  name,
  size = 36,
  src,
  kind = "investor",
  ticker,
  company,
  className = "",
}: {
  name: string;
  size?: number;
  /** Photo URL that wins over everything else. */
  src?: string | null;
  kind?: AuraKind;
  /** Company of an insider: its logo stands in for the person's photo. */
  ticker?: string | null;
  company?: string;
  className?: string;
}) {
  const title = wikiTitleFor(name);
  const portrait = !src && title ? PORTRAITS[title] ?? null : null;
  const known = src || portrait?.src || null;
  const fund = !known && title ? FUND_LOGOS[title] ?? null : null;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [known]);

  const style = { width: size, height: size, minWidth: size } as const;

  if (!known && kind === "insider" && ticker) {
    return <CompanyLogo ticker={ticker} company={company ?? name} size={size} rounded="rounded-full" className={className} />;
  }
  if (fund && !failed) {
    return (
      <span style={style} className={`logo-edge-light inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white align-top ${className}`}>
        <img
          src={fund.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className={fund.tile ? "h-full w-full object-cover" : "h-[68%] w-[68%] object-contain"}
        />
      </span>
    );
  }

  if (known && !failed) {
    const f = portrait?.focus;
    return (
      <span style={style} className={`inline-block shrink-0 overflow-hidden rounded-full bg-surface2 align-top ${className}`}>
        <img
          src={known}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          style={f ? { objectPosition: `${f.x}% ${f.y}%`, transform: `scale(${f.zoom})`, transformOrigin: `${f.x}% ${f.y}%` } : undefined}
          className="h-full w-full object-cover object-top"
        />
      </span>
    );
  }
  const s = seed(name);
  const x = 20 + Math.round(s * 60);
  const y = 10 + Math.round(((s * 7) % 1) * 40);
  return (
    <span
      aria-hidden="true"
      style={{
        ...style,
        background: `radial-gradient(90% 90% at ${x}% ${y}%, rgb(255 255 255 / 0.42), transparent 62%), linear-gradient(160deg, rgb(var(--aura-${kind}) / 0.82), rgb(var(--aura-${kind})))`,
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full align-top font-display font-semibold text-white ${className}`}
    >
      <span style={{ fontSize: Math.round(size * 0.36), textShadow: "0 1px 6px rgb(0 0 0 / 0.18)" }}>{initials(name)}</span>
    </span>
  );
}
