"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { AuraField } from "@/components/AuraField";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Icon, type IconName } from "@/components/Icon";
import { Wordmark } from "@/components/Wordmark";
import { fetchCatalogue } from "@/lib/fetchJson";
import type { InvestorsResponse, PoliticiansResponse, StocksResponse } from "@/lib/types";
import { type FollowKind, getFollowed, toggleFollow } from "@/lib/watchlist";

const SEEN = "aura:onboarded";

/* The rotating word: who discloses. Each has its aura. */
const WORDS: { word: string; icon: IconName; aura: "investor" | "insider" | "politician"; focus: [number, number, number] }[] = [
  { word: "Investoren", icon: "chart", aura: "investor", focus: [1, 0.2, 0.25] },
  { word: "Insider", icon: "work", aura: "insider", focus: [0.2, 1, 0.3] },
  { word: "Politiker", icon: "people", aura: "politician", focus: [0.25, 0.3, 1] },
];

type Pick = { id: string; name: string; src?: string | null; ticker?: string | null };
type Step = { kind: FollowKind; icon: IconName; aura: "investor" | "insider" | "politician"; title: string; text: string; focus: [number, number, number] };

const STEPS: Step[] = [
  { kind: "investor", icon: "chart", aura: "investor", title: "Investoren folgen", text: "Wähle, wessen Quartalsdepots du im Blick haben willst.", focus: [1, 0.15, 0.2] },
  { kind: "politician", icon: "people", aura: "politician", title: "Abgeordnete folgen", text: "Mitglieder des US-Repräsentantenhauses, die zuletzt Aktien gehandelt haben.", focus: [0.2, 0.25, 1] },
  { kind: "stock", icon: "work", aura: "insider", title: "Aktien merken", text: "Du siehst sofort, wenn Investoren, Insider oder Politiker sie handeln.", focus: [0.25, 1, 0.3] },
];

function useWordWheel(active: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % WORDS.length), 2200);
    return () => window.clearInterval(t);
  }, [active]);
  return i;
}

function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const i = useWordWheel(true);
  const start = useRef<HTMLButtonElement>(null);
  useEffect(() => start.current?.focus(), []);
  return (
    <div className="relative flex h-full flex-col">
      <AuraField vivid focus={WORDS[i].focus} className="pointer-events-none absolute inset-x-[-10%] bottom-[-8%] h-[72%] w-[120%] [mask-image:linear-gradient(to_bottom,transparent,#000_30%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/30 via-black/10 to-transparent" />

      <div className="relative px-7 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <Wordmark height={16} />
      </div>

      {/* Word wheel */}
      <div className="relative mt-[14vh] h-[9.5rem] overflow-hidden px-7" aria-live="polite">
        {WORDS.map((w, n) => {
          const offset = ((n - i + WORDS.length + 1) % WORDS.length) - 1; // -1 above, 0 centre, 1 below
          return (
            <div
              key={w.word}
              aria-hidden={offset !== 0}
              className="absolute left-7 top-1/2 flex items-center gap-3 transition-[transform,opacity] duration-700 ease-spring"
              // With three words the one arriving below always wraps round from
              // above, so it jumps instead of sliding through the centre.
              style={{ transform: `translateY(calc(-50% + ${offset * 3.1}rem)) scale(${offset === 0 ? 1 : 0.86})`, transformOrigin: "left center", opacity: offset === 0 ? 1 : 0.16, transitionDuration: offset === 1 ? "0ms" : undefined }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[11px] text-white transition-colors duration-700" style={{ background: `rgb(var(--aura-${w.aura}))` }}>
                <Icon name={w.icon} className="h-5 w-5" />
              </span>
              <span className="font-display text-[40px] font-bold leading-none tracking-[-0.02em]">{w.word}</span>
            </div>
          );
        })}
      </div>

      <div className="relative mt-auto px-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white">
        <h2 id="onboarding-title" className="max-w-sm font-display text-[34px] font-bold leading-[1.02] tracking-[-0.02em]">Sieh, was die Mächtigen kaufen.</h2>
        <p className="mt-3 max-w-sm text-[15px] leading-snug text-white/80">Investoren, Insider und Abgeordnete müssen ihre Trades offenlegen. ĀURA zeigt sie dir – verständlich und mit Quelle.</p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button ref={start} onClick={onStart} className="press inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-[#fff] text-[16px] font-semibold text-black shadow-[0_8px_24px_rgb(0_0_0/0.18)]">Los geht’s</button>
          <button onClick={onSkip} className="press inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white/20 text-[16px] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.45),inset_0_0_0_0.5px_rgb(255_255_255/0.3)] backdrop-blur-xl">Später</button>
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
        <div className="text-[13px] font-semibold leading-tight">Deine ĀURA<br /><span className="font-normal text-subtle">einrichten</span></div>
        <button onClick={onClose} aria-label="Schließen" className="press-sm flex h-11 w-11 items-center justify-center rounded-full bg-card/70 backdrop-blur-md"><Icon name="close" className="h-5 w-5 text-subtle" /></button>
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
                    ? <p className="col-span-4 text-[14px] text-subtle">Gerade keine Auswahl verfügbar – du kannst das später auf den Detailseiten nachholen.</p>
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
              <div id="onboarding-title" className="text-[17px] font-semibold">Deine ĀURA ist bereit.</div>
              <div className="text-[14px] text-subtle">Alles, dem du folgst, findest du auf der Startseite.</div>
            </div>
          </div>
        )}
      </div>

      <div className="relative px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {done ? (
          <button onClick={onDone} className="btn-primary w-full !min-h-[3.25rem] text-[16px]">Los geht’s</button>
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <button onClick={() => setStep((n) => n + 1)} className="btn-primary !min-h-[3.25rem] text-[16px]">
              {count > 0 ? `Weiter · ${count} gewählt` : "Weiter"}
            </button>
            <button onClick={() => setStep(STEPS.length)} className="btn-capsule !min-h-[3.25rem]">Überspringen</button>
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
    const ask = params.get("willkommen");
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
      if (params.get("willkommen")) router.replace(path || "/", { scroll: false });
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

/** First-visit onboarding on the start page; reopen with ?willkommen=1. */
export function Onboarding() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}
