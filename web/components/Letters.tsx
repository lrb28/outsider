"use client";

import Link from "next/link";

import { Avatar } from "@/components/Avatar";
import { formatDate } from "@/lib/format";
import type { LetterKind, LetterSummary, Stance } from "@/lib/types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Feb 28, 2026", or "January 2026" for letters that only carry a month. */
export function letterDate(l: Pick<LetterSummary, "publishedOn" | "precision">): string {
  if (l.precision === "month") {
    const m = /^(\d{4})-(\d{2})/.exec(l.publishedOn);
    if (m) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  }
  return formatDate(l.publishedOn);
}

export const KIND_LABEL: Record<LetterKind, string> = {
  annual_letter: "Annual letter",
  quarterly_letter: "Quarterly letter",
  memo: "Memo",
  activist_letter: "Letter to a company",
  commentary: "Commentary",
};

const STANCE_LABEL: Record<Stance, string> = { bullish: "Bullish", neutral: "Neutral", bearish: "Bearish" };

/** The letter's tone, always as a word; the tint only repeats it. */
export function StancePill({ stance, className = "" }: { stance: Stance; className?: string }) {
  const tone =
    stance === "bullish"
      ? "bg-bull-fill/15 text-bull"
      : stance === "bearish"
      ? "bg-bear-fill/15 text-bear"
      : "bg-surface2 text-subtle";
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold ${tone} ${className}`}>
      {STANCE_LABEL[stance]}
    </span>
  );
}

/**
 * A letter in a list or a sideways row (after Eaves): its title, tone and
 * date, the one-sentence headline, and who wrote it.
 */
export function LetterCard({ letter, className = "" }: { letter: LetterSummary; className?: string }) {
  return (
    <Link href={`/letter/${letter.slug}`} className={`card lcard-hover press flex flex-col p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{letter.title}</div>
        <StancePill stance={letter.stance} />
      </div>
      <div className="mt-1 text-[13px] text-subtle">
        {KIND_LABEL[letter.kind]} · {letterDate(letter)}
      </div>
      <p className="mt-2.5 line-clamp-3 text-[14px] leading-snug text-ink/80">{letter.headline}</p>
      <div className="mt-auto flex items-center gap-2 pt-3.5">
        <Avatar name={letter.author} size={26} />
        <span className="truncate text-[13px] font-medium">{letter.author}</span>
        {letter.org && <span className="truncate text-[13px] text-subtle">· {letter.org}</span>}
      </div>
    </Link>
  );
}
