"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ErrorRetry } from "@/components/ErrorRetry";
import { Icon } from "@/components/Icon";
import { KIND_LABEL, LetterCard, letterDate, StancePill } from "@/components/Letters";
import { SkeletonPage } from "@/components/Skeleton";
import { SwipeRow } from "@/components/SwipeRow";
import { DetailTopBar } from "@/components/ui";
import { fetchJson } from "@/lib/fetchJson";
import { stockHref } from "@/lib/format";
import type { Letter, LetterResponse, LettersResponse, LetterSummary } from "@/lib/types";

const LABEL_HINT: Record<Letter["takeaways"][number]["label"], string> = {
  Move: "What they did",
  View: "What they think",
  Watch: "What to watch",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">{title}</h2>
      {children}
    </section>
  );
}

/** A ticker named in a takeaway: a link where ĀURA has the stock. */
function TickerChip({ ticker, linked }: { ticker: string; linked: boolean }) {
  const cls = "inline-flex h-7 items-center gap-1.5 rounded-full bg-surface2 pl-1 pr-2.5 text-[12px] font-semibold";
  const body = (
    <>
      <CompanyLogo ticker={ticker} company={ticker} size={20} rounded="rounded-full" />
      {ticker}
    </>
  );
  return linked ? (
    <Link href={stockHref(ticker)} className={`${cls} transition-colors hover:bg-ink/10`}>{body}</Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

export default function LetterPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const [letter, setLetter] = useState<Letter | null>(null);
  const [more, setMore] = useState<LetterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLoading(true);
    setErr(false);
    fetchJson<LetterResponse>(`/api/letter?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((d) => {
        setLetter(d.letter);
        if (d.letter?.investorSlug)
          fetchJson<LettersResponse>(`/api/letters?investor=${encodeURIComponent(d.letter.investorSlug)}&limit=6`, { signal: controller.signal })
            .then((m) => setMore(m.rows.filter((r) => r.slug !== slug)))
            .catch(() => {});
      })
      .catch(() => { if (!controller.signal.aborted) setErr(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, tick]);

  if (loading) return <SkeletonPage />;
  if (err) return <ErrorRetry onRetry={() => setTick((t) => t + 1)} />;
  if (!letter)
    return (
      <div className="py-16 text-center text-[15px] text-subtle">
        Letter not found.{" "}
        <Link href="/feed?type=letters" className="text-ink underline">Back to Letters</Link>
      </div>
    );

  const known = new Set(letter.stocks.filter((s) => s.known && s.ticker).map((s) => s.ticker as string));

  return (
    <div className="space-y-8">
      <div className="aura-header space-y-5" style={{ ["--aura" as string]: "var(--aura-investor)" }}>
        <DetailTopBar back="/feed?type=letters" label="Letters" />

        <div className="fade-up space-y-3">
          {letter.investorSlug ? (
            <Link href={`/investor/${letter.investorSlug}`} className="inline-flex items-center gap-2.5 rounded-full pr-2 transition-opacity hover:opacity-80">
              <Avatar name={letter.author} size={40} />
              <span className="leading-tight">
                <span className="block text-[15px] font-semibold">{letter.author}</span>
                {letter.org && <span className="block text-[13px] text-subtle">{letter.org}</span>}
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-2.5">
              <Avatar name={letter.author} size={40} />
              <span className="leading-tight">
                <span className="block text-[15px] font-semibold">{letter.author}</span>
                {letter.org && <span className="block text-[13px] text-subtle">{letter.org}</span>}
              </span>
            </div>
          )}
          <h1 className="font-display text-[clamp(26px,7.4vw,34px)] font-bold leading-[1.08] tracking-[-0.02em]">{letter.title}</h1>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <StancePill stance={letter.stance} />
            <span className="text-[13px] text-subtle">{KIND_LABEL[letter.kind]} · {letterDate(letter)}</span>
          </div>
        </div>

        {/* The point of the letter first, then the paragraph behind it. */}
        <div className="fade-up relative overflow-hidden rounded-[22px] p-5" style={{ background: "linear-gradient(160deg, rgb(var(--aura-investor) / 0.16), rgb(var(--aura-investor) / 0.05))" }}>
          <p className="font-display text-[20px] font-bold leading-snug tracking-[-0.01em]">{letter.headline}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/80">{letter.summary}</p>
        </div>
      </div>

      {letter.takeaways.length > 0 && (
        <Section title="Takeaways">
          <div className="card divide-y divide-hair overflow-hidden">
            {letter.takeaways.map((t, i) => (
              <div key={i} className="space-y-1.5 px-4 py-3.5">
                <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-subtle">
                  {t.label} <span className="font-medium normal-case tracking-normal">· {LABEL_HINT[t.label]}</span>
                </div>
                <p className="text-[15px] leading-snug">{t.text}</p>
                {t.tickers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.tickers.map((tk) => <TickerChip key={tk} ticker={tk} linked={known.has(tk)} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {letter.risks.length > 0 && (
        <Section title="Risks they’re watching">
          <div className="card divide-y divide-hair overflow-hidden">
            {letter.risks.map((r, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-bear-fill" />
                <p className="min-w-0 flex-1 text-[15px] leading-snug">{r.text}</p>
                <span className="mt-0.5 shrink-0 rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-subtle">{r.scope}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {letter.quotes.length > 0 && (
        <Section title="In their words">
          <div className="space-y-3">
            {letter.quotes.map((q, i) => (
              <figure key={i} className="card relative overflow-hidden p-4 pl-5">
                <span aria-hidden="true" className="absolute inset-y-4 left-0 w-[3px] rounded-r-full bg-[rgb(var(--aura-investor))]" />
                <blockquote className="text-[16px] leading-relaxed">“{q.text}”</blockquote>
                {q.context && <figcaption className="mt-2 text-[13px] text-subtle">{q.context}</figcaption>}
              </figure>
            ))}
          </div>
        </Section>
      )}

      {letter.stocks.length > 0 && (
        <Section title="Stocks discussed">
          <div className="card overflow-hidden">
            {letter.stocks.map((s, i) => {
              const body = (
                <>
                  <CompanyLogo ticker={s.ticker} company={s.company} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold leading-tight">{s.company}</div>
                    {s.note && <div className="mt-0.5 line-clamp-3 text-[13px] leading-snug text-subtle">{s.ticker ? `${s.ticker} · ` : ""}{s.note}</div>}
                  </div>
                  <StancePill stance={s.stance} />
                </>
              );
              const cls = "relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-[4.25rem] after:right-0 after:h-px after:bg-hair last:after:hidden";
              return s.known && s.ticker ? (
                <Link key={i} href={stockHref(s.ticker)} className={`${cls} transition-colors hover:bg-ink/[0.03] active:bg-ink/[0.06]`}>{body}</Link>
              ) : (
                <div key={i} className={cls}>{body}</div>
              );
            })}
          </div>
        </Section>
      )}

      <div className="space-y-3">
        <a href={letter.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-capsule w-full">
          <Icon name="document" className="h-4 w-4" />
          Read the original
        </a>
        <p className="text-[13px] leading-relaxed text-subtle">
          {letter.sourceName ? `Source: ${letter.sourceName}. ` : ""}Summary by {letter.summarizedBy ?? "ĀURA editors"} from the original document. Quotes are verbatim; figures are as stated by the author.
          The tone label is our reading of the letter. Not investment advice.
        </p>
      </div>

      {more.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">More from {letter.author}</h2>
          <SwipeRow className="gap-3">
            {more.map((l) => <LetterCard key={l.slug} letter={l} className="w-[300px] shrink-0 snap-start" />)}
          </SwipeRow>
        </section>
      )}
    </div>
  );
}
