"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Icon, type IconName } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { PageTitle } from "@/components/ui";
import { Mark } from "@/components/Wordmark";
import { PORTFOLIO } from "@/lib/features";
import { fetchCatalogue } from "@/lib/fetchJson";
import { companyName, stockHref } from "@/lib/format";
import { loadCurrency } from "@/lib/money";
import { getTxns, positionsFrom, toCsv } from "@/lib/portfolio";
import { type Theme, getTheme, setTheme } from "@/lib/theme";
import type { InvestorsResponse, PoliticiansResponse } from "@/lib/types";
import { type FollowKind, getFollowed, toggleFollow } from "@/lib/watchlist";

/*
 * Settings, behind the gear in the tab bar (after the Fuse wallet app the
 * user showed): a card to set up what you follow, then grouped rows with a
 * coloured glyph each, the destructive action in red at the end, and the
 * version and legal links at the bottom. Details open as sheets.
 *
 * Everything here is stored on this device only; there is no account.
 */

const THEMES: { key: Theme; label: string; hint: string }[] = [
  { key: "system", label: "System", hint: "Follows your device" },
  { key: "light", label: "Light", hint: "Always light" },
  { key: "dark", label: "Dark", hint: "Always dark" },
];

const FOLLOWS: { kind: FollowKind; label: string; icon: IconName; colour: string; aura: "investor" | "insider" | "politician"; empty: string }[] = [
  { kind: "investor", label: "Investors", icon: "chart", colour: "var(--aura-investor)", aura: "investor", empty: "You don't follow any investors yet." },
  { kind: "politician", label: "Politicians", icon: "people", colour: "var(--aura-politician)", aura: "politician", empty: "You don't follow any politicians yet." },
  { kind: "stock", label: "Stocks", icon: "work", colour: "var(--aura-insider)", aura: "insider", empty: "You aren't watching any stocks yet." },
];

type Open = null | "theme" | "reset" | FollowKind;

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      {title && <h2 className="px-4 text-[13px] font-medium text-subtle">{title}</h2>}
      <div className="card overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ icon, colour, label, value, href, onClick, danger = false, external = false }: { icon: IconName; colour: string; label: string; value?: ReactNode; href?: string; onClick?: () => void; danger?: boolean; external?: boolean }) {
  const body = (
    <>
      <Icon name={icon} className="h-[22px] w-[22px] shrink-0" style={{ color: `rgb(${colour})` }} />
      <span className={`min-w-0 flex-1 truncate text-[16px] ${danger ? "font-medium text-bear" : "text-ink"}`}>{label}</span>
      {value != null && <span className="shrink-0 text-[15px] tabular-nums text-subtle">{value}</span>}
      {!danger && <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-muted" />}
    </>
  );
  const cls = "relative flex min-h-[3.25rem] w-full items-center gap-3.5 px-4 text-left transition-colors hover:bg-ink/[0.03] active:bg-ink/[0.06] after:absolute after:bottom-0 after:left-[3.25rem] after:right-0 after:h-px after:bg-hair last:after:hidden";
  if (href) return <Link href={href} className={cls} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{body}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

type Person = { id: string; name: string; photo?: string | null };

function FollowList({ kind, onClose }: { kind: FollowKind; onClose: () => void }) {
  const meta = FOLLOWS.find((f) => f.kind === kind)!;
  const [ids, setIds] = useState<string[]>(() => getFollowed(kind));
  const [names, setNames] = useState<Map<string, Person> | null>(kind === "stock" ? new Map() : null);

  useEffect(() => {
    if (kind === "investor")
      fetchCatalogue<InvestorsResponse>("/api/investors")
        .then((d) => setNames(new Map(d.rows.map((r) => [r.slug, { id: r.slug, name: r.person ?? r.fund }]))))
        .catch(() => setNames(new Map()));
    if (kind === "politician")
      fetchCatalogue<PoliticiansResponse>("/api/politicians")
        .then((d) => setNames(new Map(d.rows.map((r) => [r.slug, { id: r.slug, name: r.name, photo: r.photo }]))))
        .catch(() => setNames(new Map()));
  }, [kind]);

  const remove = (id: string) => {
    try {
      toggleFollow(kind, id);
      setIds((list) => list.filter((x) => x !== id));
    } catch {
      /* StorageNotice reports the failed write. */
    }
  };
  const href = (id: string) => (kind === "stock" ? stockHref(id) : `/${kind}/${id}`);

  return (
    <Sheet title={meta.label} subtitle={ids.length ? `${ids.length} followed` : undefined} onClose={onClose}>
      <div className="px-5 pb-5">
        {ids.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[15px] text-subtle">{meta.empty}</p>
            <Link href="/?welcome=folgen" className="btn-primary mt-4">Choose {meta.label.toLowerCase()}</Link>
          </div>
        ) : (
          <ul className="card overflow-hidden !shadow-none ring-1 ring-hair">
            {ids.map((id) => {
              const who = names?.get(id);
              const name = kind === "stock" ? companyName(id, null) : who?.name ?? id;
              return (
                <li key={id} className="relative flex items-center gap-3 px-3 py-2 after:absolute after:bottom-0 after:left-[3.75rem] after:right-0 after:h-px after:bg-hair last:after:hidden">
                  <Link href={href(id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3">
                    {kind === "stock" ? <CompanyLogo ticker={id} company={name} size={36} /> : <Avatar name={name} src={who?.photo} kind={meta.aura} size={36} />}
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{names === null ? <span className="inline-block h-4 w-32 rounded shimmer align-middle" /> : name}</span>
                  </Link>
                  <button type="button" onClick={() => remove(id)} className="press-sm min-h-11 shrink-0 rounded-full px-3 text-[14px] font-medium text-subtle hover:text-bear">
                    Unfollow
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

export default function SettingsPage() {
  const [open, setOpen] = useState<Open>(null);
  const [theme, setThemeState] = useState<Theme>("system");
  const [counts, setCounts] = useState<Record<FollowKind, number>>({ investor: 0, politician: 0, stock: 0 });
  const [depot, setDepot] = useState<{ positions: number; currency: string } | null>(null);
  const [shared, setShared] = useState(false);

  const read = useCallback(() => {
    setCounts({ investor: getFollowed("investor").length, politician: getFollowed("politician").length, stock: getFollowed("stock").length });
    try {
      setDepot({ positions: positionsFrom(getTxns()).filter((p) => p.shares > 0).length, currency: loadCurrency() });
    } catch {
      setDepot({ positions: 0, currency: "USD" });
    }
  }, []);

  useEffect(() => {
    setThemeState(getTheme());
    read();
    window.addEventListener("watchlist", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("watchlist", read);
      window.removeEventListener("storage", read);
    };
  }, [read]);

  const pickTheme = (t: Theme) => {
    setTheme(t);
    setThemeState(t);
  };

  const share = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: "Outsider", text: "What investors, insiders and US politicians disclose.", url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        window.setTimeout(() => setShared(false), 2200);
      }
    } catch {
      /* dismissed */
    }
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(getTxns())], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outsider-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const resetAll = () => {
    try {
      const keys = Object.keys(window.localStorage).filter((k) => k.startsWith("outsider:") || k.startsWith("aura:"));
      for (const k of keys) window.localStorage.removeItem(k);
      window.sessionStorage.clear();
    } catch {
      /* nothing stored */
    }
    window.location.assign("/");
  };

  const following = counts.investor + counts.politician + counts.stock;
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
  const commit = process.env.NEXT_PUBLIC_COMMIT ?? "";

  return (
    <div className="space-y-7">
      <PageTitle title="Settings" />

      {/* Set up what you follow (like Fuse's membership card). */}
      <Link href="/?welcome=folgen" className="card fade-up flex items-center gap-3.5 p-4 transition-transform active:scale-[0.99]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-ink text-card">
          <Mark size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold">{following ? "Your Outsider" : "Set up Outsider"}</span>
          <span className="block truncate text-[14px] text-subtle">{following ? `Following ${following} · add more` : "Follow investors, politicians and stocks"}</span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-card">
          <Icon name="chevronRight" className="h-4 w-4" />
        </span>
      </Link>

      <Group title="Following">
        {FOLLOWS.map((f) => (
          <Row key={f.kind} icon={f.icon} colour={f.colour} label={f.label} value={counts[f.kind] || undefined} onClick={() => setOpen(f.kind)} />
        ))}
      </Group>

      <Group title="General">
        <Row icon="show" colour="var(--cat-3)" label="Appearance" value={THEMES.find((t) => t.key === theme)?.label} onClick={() => setOpen("theme")} />
        {PORTFOLIO && <Row icon="graph" colour="var(--cat-1)" label="Portfolio" value={depot ? (depot.positions ? `${depot.positions} positions · ${depot.currency}` : "Empty") : undefined} href="/me" />}
        {PORTFOLIO && !!depot?.positions && <Row icon="download" colour="var(--cat-5)" label="Export portfolio as CSV" onClick={exportCsv} />}
      </Group>

      <Group title="About">
        <Row icon="star" colour="var(--cat-4)" label="Introduction" href="/?welcome=1" />
        <Row icon="document" colour="var(--cat-6)" label="Sources & methodology" href="/methodik" />
        <Row icon="activity" colour="var(--bull-fill)" label="Data status" href="/status" />
        <Row icon="shield" colour="var(--cat-2)" label="Privacy" href="/datenschutz" />
        <Row icon="swap" colour="var(--aura-politician)" label={shared ? "Link copied" : "Share Outsider"} onClick={share} />
      </Group>

      <Group>
        <Row icon="delete" colour="var(--bear-fill)" label="Delete all data" danger onClick={() => setOpen("reset")} />
      </Group>

      <footer className="flex flex-col items-center gap-1.5 pb-2 pt-2 text-center">
        <Mark size={16} className="text-subtle" />
        <p className="text-[13px] font-medium text-subtle">
          Version {version}
          {commit && ` (${commit})`}
        </p>
        <p className="text-[12px] text-muted">Everything you set here stays on this device.</p>
        <p className="text-[12px] text-subtle">
          <Link href="/datenschutz" className="hover:text-ink">Privacy</Link> · <Link href="/methodik" className="hover:text-ink">Methodology</Link>
        </p>
      </footer>

      {open === "theme" && (
        <Sheet title="Appearance" onClose={() => setOpen(null)}>
          <div className="px-5 pb-5">
            <div className="card overflow-hidden !shadow-none ring-1 ring-hair" role="radiogroup" aria-label="Appearance">
              {THEMES.map((t) => {
                const on = theme === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickTheme(t.key)}
                    className="relative flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-hair last:after:hidden"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-medium">{t.label}</span>
                      <span className="block text-[13px] text-subtle">{t.hint}</span>
                    </span>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${on ? "bg-ink text-card" : "ring-[1.5px] ring-inset ring-hair"}`}>
                      {on && <Icon name="check" className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Sheet>
      )}

      {(open === "investor" || open === "politician" || open === "stock") && <FollowList kind={open} onClose={() => setOpen(null)} />}

      {open === "reset" && (
        <Sheet title="Delete all data?" subtitle={`Removes ${PORTFOLIO ? "your portfolio and its import, " : ""}everything you follow and your settings from this device. This can’t be undone.`} onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-2.5 px-5 pb-5 pt-1">
            <button type="button" onClick={resetAll} className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-bear-fill text-[16px] font-semibold text-white transition-transform active:scale-[0.98]">
              Delete all data
            </button>
            <button type="button" onClick={() => setOpen(null)} className="btn-capsule !min-h-[3.25rem] text-[16px]">
              Keep my data
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
