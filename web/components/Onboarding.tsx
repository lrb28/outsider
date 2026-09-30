"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { AuraField } from "@/components/AuraField";
import { SilkVideo } from "@/components/SilkVideo";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Icon, type IconName } from "@/components/Icon";
import { fetchCatalogue } from "@/lib/fetchJson";
import { MARK_HEIGHT, MARK_PATH, MARK_WIDTH } from "@/lib/wordmark";
import type { InvestorsResponse, PoliticiansResponse, StocksResponse } from "@/lib/types";
import { type FollowKind, getFollowed, toggleFollow } from "@/lib/watchlist";

// v2: everyone sees the new first screen once.
const SEEN = "aura:onboarded:v2";

type Pick = { id: string; name: string; src?: string | null; ticker?: string | null };
type Step = { kind: FollowKind; icon: IconName; aura: "investor" | "insider" | "politician"; title: string; text: string; focus: [number, number, number] };

const STEPS: Step[] = [
  { kind: "investor", icon: "chart", aura: "investor", title: "Follow investors", text: "Choose whose quarterly portfolios you want to keep an eye on.", focus: [1, 0.15, 0.2] },
  { kind: "politician", icon: "people", aura: "politician", title: "Follow politicians", text: "Members of the US House of Representatives who traded stocks recently.", focus: [0.2, 0.25, 1] },
  { kind: "stock", icon: "work", aura: "insider", title: "Watch stocks", text: "See at once when investors, insiders or politicians trade them.", focus: [0.25, 1, 0.3] },
];


/*
 * First screen, after the reference wallet app: its silk animation (the
 * user's video, 1:1) on a white page (black in dark mode), the mark in the
 * upper middle, a three-line headline bottom left and two equal frosted
 * capsules, placed where the video had its own.
 */
function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const start = useRef<HTMLButtonElement>(null);
  useEffect(() => start.current?.focus({ preventScroll: true }), []);
  return (
    <div className="welcome-screen relative flex h-full flex-col overflow-hidden">
      <SilkVideo className="pointer-events-none absolute inset-0" />

      <svg viewBox={`-2 -2 ${MARK_WIDTH + 4} ${MARK_HEIGHT + 4}`} role="img" aria-label="AURA" className="welcome-mark absolute left-1/2 top-[36%] w-[3.6rem] -translate-x-1/2 -translate-y-1/2">
        <path d={MARK_PATH} fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="miter" />
      </svg>

      <div className="relative mt-auto px-8 pb-[max(2.75rem,calc(env(safe-area-inset-bottom)+0.6rem))]">
        <h2 id="onboarding-title" aria-label="Money leaves clues" className="font-display text-[2.7rem] font-semibold leading-[1] tracking-[-0.025em]">
          {["Money", "leaves", "clues"].map((w, i) => (
            <span key={w} aria-hidden="true" className="welcome-line block" style={{ animationDelay: `${260 + i * 90}ms` }}>
              {w}
            </span>
          ))}
        </h2>
        <div className="welcome-line mt-8 grid grid-cols-2 gap-5" style={{ animationDelay: "560ms" }}>
          <button type="button" onClick={onSkip} className="welcome-pill press">
            Later
          </button>
          <button ref={start} type="button" onClick={onStart} className="welcome-pill press">
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}

function Setup({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [options, setOptions] = useState<Record<FollowKind, Pick[] | null>>({ investor: null, politician: null, stock: null });
  const [chosen, setChosen] = useState<Record<FollowKind, string[]>>({ investor: [], politician: [], stock: [] });
  const done = step >= STEPS.length;

  useEffect(() => {
    setChosen({ investor: getFollowed("investor"), politician: getFollowed("politician"), stock: getFollowed("stock") });
    fetchCatalogue<InvestorsResponse>("/api/investors")
      .then((d) => setOptions((o) => ({ ...o, investor: d.rows.filter((r) => r.person).slice(0, 12).map((r) => ({ id: r.slug, name: r.person ?? r.fund })) })))
      .catch(() => setOptions((o) => ({ ...o, investor: [] })));
    fetchCatalogue<PoliticiansResponse>("/api/politicians")
      .then((d) => setOptions((o) => ({ ...o, politician: d.rows.slice(0, 12).map((r) => ({ id: r.slug, name: r.name, src: r.photo })) })))
      .catch(() => setOptions((o) => ({ ...o, politician: [] })));
    fetchCatalogue<StocksResponse>("/api/stocks")
      .then((d) => setOptions((o) => ({ ...o, stock: [...d.rows].filter((r) => r.ticker).sort((a, b) => b.investors - a.investors).slice(0, 12).map((r) => ({ id: r.ticker!, name: r.company, ticker: r.ticker })) })))
      .catch(() => setOptions((o) => ({ ...o, stock: [] })));
  }, []);

  const toggle = (kind: FollowKind, id: string) => {
    try {
      const on = toggleFollow(kind, id);
      setChosen((c) => ({ ...c, [kind]: on ? [...c[kind], id] : c[kind].filter((x) => x !== id) }));
    } catch {
      /* StorageNotice reports the failed write. */
    }
  };

  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const focus: [number, number, number] = done ? [0.6, 0.6, 0.6] : current.focus;
  const count = done ? 0 : chosen[current.kind].length;

  return (
    <div className="relative flex h-full flex-col">
      <AuraField vivid focus={focus} className="pointer-events-none absolute inset-x-0 top-0 h-[46%] w-full [mask-image:linear-gradient(to_top,transparent,#000_55%)]" />
      <div className="relative flex items-start justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="text-[13px] font-semibold leading-tight">Set up<br /><span className="font-normal text-subtle">your ĀURA</span></div>
        <button onClick={onClose} className="press-sm -mr-2 min-h-11 rounded-full px-3 text-[15px] font-medium text-subtle hover:text-ink">Close</button>
      </div>

      <div className="relative mt-auto px-6">
        {STEPS.map((s, n) => {
          const state = n < step ? "done" : n === step ? "active" : "next";
          if (state !== "active") {
            return (
              <div key={s.kind} className={`flex items-center gap-2 py-1.5 text-[14px] font-medium ${state === "done" ? "text-subtle" : "text-muted"}`}>
                <Icon name={state === "done" ? "tick" : s.icon} className="h-[18px] w-[18px]" />
                {s.title}
                {state === "done" && chosen[s.kind].length > 0 && <span className="text-subtle">· {chosen[s.kind].length}</span>}
              </div>
            );
          }
          const list = options[s.kind];
          return (
            <div key={s.kind} className="fade-up py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[11px] text-white" style={{ background: `rgb(var(--aura-${s.aura}))` }}><Icon name={s.icon} className="h-5 w-5" /></span>
              <h2 id="onboarding-title" className="mt-3 font-display text-[28px] font-bold leading-tight tracking-[-0.015em]">{s.title}</h2>
              <p className="mt-1 max-w-sm text-[15px] leading-snug text-subtle">{s.text}</p>
              <div className="no-scrollbar -mx-6 mt-4 grid max-h-[34vh] grid-cols-4 gap-x-2 gap-y-4 overflow-y-auto px-6 pb-2 sm:grid-cols-6">
                {list === null
                  ? Array.from({ length: 8 }).map((_, k) => <div key={k} className="mx-auto h-14 w-14 rounded-full shimmer" />)
                  : list.length === 0
                    ? <p className="col-span-4 text-[14px] text-subtle">Nothing to choose from right now. You can follow from any detail page later.</p>
                    : list.map((p) => {
                        const on = chosen[s.kind].includes(p.id);
                        return (
                          <button key={p.id} onClick={() => toggle(s.kind, p.id)} aria-pressed={on} className="press flex !min-h-0 flex-col items-center gap-1.5 text-center">
                            <span className={`relative transition-transform duration-300 ease-spring ${on ? "scale-105" : ""}`}>
                              {p.ticker ? <CompanyLogo ticker={p.ticker} company={p.name} size={56} rounded="rounded-[16px]" /> : <Avatar name={p.name} src={p.src} kind={s.aura} size={56} />}
                              <span className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-[transform,opacity] duration-300 ease-spring ${on ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} style={{ background: `rgb(var(--aura-${s.aura}))` }}>
                                <Icon name="tick" className="h-4 w-4" />
                              </span>
                            </span>
                            <span className={`line-clamp-2 w-full text-[11px] leading-tight ${on ? "font-semibold text-ink" : "text-subtle"}`}>{p.name}</span>
                          </button>
                        );
                      })}
              </div>
            </div>
          );
        })}

        {done && (
          <div className="fade-up flex items-center gap-2 py-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bull-fill text-white"><Icon name="tick" className="h-4 w-4" /></span>
            <div>
              <div id="onboarding-title" className="text-[17px] font-semibold">Your ĀURA is ready.</div>
              <div className="text-[14px] text-subtle">Everything you follow is on the home page.</div>
            </div>
          </div>
        )}
      </div>

      <div className="relative px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {done ? (
          <button onClick={onDone} className="btn-primary w-full !min-h-[3.25rem] text-[16px]">Get started</button>
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <button onClick={() => setStep((n) => n + 1)} className="btn-primary !min-h-[3.25rem] text-[16px]">
              {count > 0 ? `Continue · ${count} selected` : "Continue"}
            </button>
            <button onClick={() => setStep(STEPS.length)} className="btn-capsule !min-h-[3.25rem]">Skip</button>
          </div>
        )}
      </div>
    </div>
  );
}

function OnboardingInner() {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [phase, setPhase] = useState<"closed" | "welcome" | "setup">("closed");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(SEEN) === "1";
    } catch {
      /* private mode: show once per visit */
    }
    const ask = params.get("welcome") ?? params.get("willkommen");
    if (ask === "folgen") setPhase("setup");
    else if (ask === "1" || (path === "/" && !seen)) setPhase("welcome");
  }, [path, params]);

  const close = useCallback(() => {
    try {
      window.localStorage.setItem(SEEN, "1");
    } catch {
      /* ignore */
    }
    setLeaving(true);
    window.setTimeout(() => {
      setPhase("closed");
      setLeaving(false);
      if (params.get("welcome") || params.get("willkommen")) router.replace(path || "/", { scroll: false });
    }, 350);
  }, [params, path, router]);

  useEffect(() => {
    if (phase === "closed") return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, close]);

  if (phase === "closed") return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className={`fixed inset-0 z-[70] flex justify-center bg-black/30 transition-opacity duration-300 sm:items-center sm:p-6 ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      <div className={`relative h-[100dvh] w-full overflow-hidden bg-card text-ink transition-transform duration-500 ease-spring sm:h-[min(52rem,92dvh)] sm:max-w-[26rem] sm:rounded-[2.75rem] sm:shadow-float ${leaving ? "translate-y-6" : "fade-up"}`}>
        {phase === "welcome" ? <Welcome onStart={() => setPhase("setup")} onSkip={close} /> : <Setup onDone={close} onClose={close} />}
      </div>
    </div>
  );
}

/** First-visit onboarding on the start page; reopen with ?welcome=1 (the old ?willkommen=1 still works). */
export function Onboarding() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}
