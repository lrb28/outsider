"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type RefObject, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { SilkVideo } from "@/components/SilkVideo";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Icon, type IconName } from "@/components/Icon";
import { Mark, Wordmark } from "@/components/Wordmark";
import { fetchCatalogue } from "@/lib/fetchJson";
import type { InvestorsResponse, PoliticiansResponse, StocksResponse } from "@/lib/types";
import { type FollowKind, getFollowed, toggleFollow } from "@/lib/watchlist";

// v2: everyone sees the new first screen once.
const SEEN = "aura:onboarded:v2";

const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type Pick = { id: string; name: string; src?: string | null; ticker?: string | null };
type Step = { kind: FollowKind; icon: IconName; aura: "investor" | "insider" | "politician"; title: string; text: string; verb: string; noun: [string, string] };

const STEPS: Step[] = [
  { kind: "investor", icon: "chart", aura: "investor", title: "Follow investors", text: "Choose whose quarterly portfolios you want to keep an eye on.", verb: "Follow", noun: ["investor", "investors"] },
  { kind: "politician", icon: "people", aura: "politician", title: "Follow politicians", text: "Members of the US House who traded stocks recently.", verb: "Follow", noun: ["politician", "politicians"] },
  { kind: "stock", icon: "work", aura: "insider", title: "Watch stocks", text: "See at once when investors, insiders or politicians trade them.", verb: "Watch", noun: ["stock", "stocks"] },
];

/*
 * First screen, after the reference wallet app: its silk animation (the
 * user's video, 1:1) on a white page (black in dark mode), the OUTSIDER
 * wordmark with its ring of dots in the upper middle (the dots pop up one
 * after another), a three-line headline bottom left and two equal frosted
 * capsules, placed where the video had its own. Nothing is focused on
 * arrival: a focus ring on "Get started" read as a pressed button.
 */
function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const start = () => {
    if (leaving) return;
    if (reducedMotion()) return onStart();
    setLeaving(true);
    window.setTimeout(onStart, 260);
  };
  return (
    <div className={`welcome-screen relative flex h-full touch-none select-none flex-col overflow-hidden transition-[opacity,filter] duration-300 ease-out ${leaving ? "opacity-0 blur-sm" : ""}`}>
      <SilkVideo className="pointer-events-none absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-[36%] flex -translate-y-1/2 justify-center">
        <div className="welcome-logo">
          <Wordmark height={28} animate />
        </div>
      </div>

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
          <button type="button" onClick={start} className="welcome-pill press">
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Moves every `[data-flip]` element from where it was when `snapshot` ran
 * to where the next render put it (FLIP): a finished step shrinks into its
 * row and the next row grows into the title, as in the reference app.
 */
function useFlip(host: RefObject<HTMLElement>) {
  const before = useRef(new Map<string, DOMRect>());
  const snapshot = useCallback(() => {
    before.current = new Map([...(host.current?.querySelectorAll<HTMLElement>("[data-flip]") ?? [])].map((el) => [el.dataset.flip!, el.getBoundingClientRect()]));
  }, [host]);
  const play = useCallback(() => {
    const old = before.current;
    before.current = new Map();
    if (!old.size || reducedMotion()) return;
    for (const el of host.current?.querySelectorAll<HTMLElement>("[data-flip]") ?? []) {
      const from = old.get(el.dataset.flip!);
      const to = el.getBoundingClientRect();
      if (!from || !to.width) continue;
      const scale = from.width / to.width;
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.01) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: "none" }], { duration: 560, easing: SPRING });
    }
  }, [host]);
  return { snapshot, play };
}

/*
 * The set-up after the welcome screen, after the reference wallet app's
 * "Secure your wallet": a soft glow in the step's aura colour fills the top
 * and changes colour with each step, finished steps sit above as grey rows,
 * the coming ones below, one full-width button carries the step. At the end
 * the glow clears, "Setting up Outsider" (the ring of dots running) turns
 * into "Outsider is ready!" (while the home page's data loads) and the
 * set-up fades into the app.
 */
function Setup({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [options, setOptions] = useState<Record<FollowKind, Pick[] | null>>({ investor: null, politician: null, stock: null });
  const [chosen, setChosen] = useState<Record<FollowKind, string[]>>({ investor: [], politician: [], stock: [] });
  const list = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const { snapshot, play } = useFlip(list);
  const finishing = step >= STEPS.length;
  // The glow runs out just above the steps, like the reference: finished
  // steps sit on the page, not on the colour, however tall the screen.
  const [glow, setGlow] = useState<number | null>(null);
  // Every investor, politician and the most held stocks to choose from
  // (user, 2026-10-09: "scroll, not only 8 options"): the grid scrolls, and
  // an edge fades where more choices hide.
  const [more, setMore] = useState(false);
  const [less, setLess] = useState(false);
  const measure = useCallback(() => {
    const r = root.current;
    const l = list.current;
    if (r && l) setGlow(Math.round(Math.max(170, Math.min(r.clientHeight * 0.5, l.getBoundingClientRect().top - r.getBoundingClientRect().top + 70))));
    const g = grid.current;
    setMore(!!g && g.scrollHeight - g.scrollTop - g.clientHeight > 4);
    setLess(!!g && g.scrollTop > 4);
  }, []);
  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, step, options]);

  useEffect(() => {
    setChosen({ investor: getFollowed("investor"), politician: getFollowed("politician"), stock: getFollowed("stock") });
    fetchCatalogue<InvestorsResponse>("/api/investors")
      // People first, then the funds without a known face.
      .then((d) => setOptions((o) => ({ ...o, investor: [...d.rows.filter((r) => r.person), ...d.rows.filter((r) => !r.person)].map((r) => ({ id: r.slug, name: r.person ?? r.fund })) })))
      .catch(() => setOptions((o) => ({ ...o, investor: [] })));
    fetchCatalogue<PoliticiansResponse>("/api/politicians")
      .then((d) => setOptions((o) => ({ ...o, politician: d.rows.map((r) => ({ id: r.slug, name: r.name, src: r.photo })) })))
      .catch(() => setOptions((o) => ({ ...o, politician: [] })));
    fetchCatalogue<StocksResponse>("/api/stocks")
      .then((d) => {
        // One tile per company: Alphabet's two share classes showed up as
        // two identical "Alphabet" tiles.
        const seen = new Set<string>();
        const rows = [...d.rows]
          .filter((r) => r.ticker)
          .sort((a, b) => b.investors - a.investors)
          .filter((r) => !seen.has(r.company) && !!seen.add(r.company))
          .slice(0, 60);
        setOptions((o) => ({ ...o, stock: rows.map((r) => ({ id: r.ticker!, name: r.company, ticker: r.ticker })) }));
      })
      .catch(() => setOptions((o) => ({ ...o, stock: [] })));
  }, []);

  useLayoutEffect(play, [step, play]);

  // "Setting up": the home page's catalogue loads meanwhile (it is cached for
  // a few seconds), then "ready", then the set-up fades into the app.
  useEffect(() => {
    if (!finishing) return;
    let alive = true;
    const quick = reducedMotion();
    const warm = Promise.allSettled(["/api/discover", "/api/stats", "/api/investors", "/api/politicians"].map((url) => fetchCatalogue(url)));
    const minimum = new Promise((r) => window.setTimeout(r, quick ? 500 : 1500));
    const cap = new Promise((r) => window.setTimeout(r, 4000));
    const timers: number[] = [];
    Promise.race([Promise.all([warm, minimum]), cap]).then(() => {
      if (!alive) return;
      setReady(true);
      timers.push(window.setTimeout(() => setExiting(true), quick ? 600 : 1300));
      timers.push(window.setTimeout(onDone, quick ? 650 : 1600));
    });
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [finishing, onDone]);

  const toggle = (kind: FollowKind, id: string) => {
    try {
      const on = toggleFollow(kind, id);
      setChosen((c) => ({ ...c, [kind]: on ? [...c[kind], id] : c[kind].filter((x) => x !== id) }));
    } catch {
      /* StorageNotice reports the failed write. */
    }
  };

  const advance = () => {
    snapshot();
    setStep((n) => n + 1);
  };

  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const count = finishing ? 0 : chosen[current.kind].length;
  const label = count > 0 ? `${current.verb} ${count} ${current.noun[count === 1 ? 0 : 1]}` : "Continue";

  return (
    <div ref={root} className={`relative flex h-full flex-col transition-opacity duration-300 ease-out ${exiting ? "opacity-0" : ""}`}>
      <div aria-hidden="true" className={`setup-glow ${finishing ? "opacity-0" : ""}`} style={glow ? { height: glow } : undefined}>
        {STEPS.map((s, n) => (
          <i key={s.kind} data-glow={s.aura} data-on={n === step ? "" : undefined} />
        ))}
      </div>

      <div className={`relative flex items-start justify-between px-6 pt-[max(1.25rem,calc(var(--edge-top)_-_0.25rem))] text-white transition-opacity duration-500 ${finishing ? "pointer-events-none opacity-0" : ""}`}>
        <div className="setup-header text-[15px] font-semibold leading-tight">
          Set up
          <br />
          <span className="font-medium text-white/75">Outsider</span>
        </div>
        <button onClick={onClose} className="setup-header press-sm -mr-3 min-h-11 rounded-full px-3 text-[15px] font-semibold text-white/90 hover:text-white">
          Close
        </button>
      </div>

      <div ref={list} className={`relative px-6 ${finishing ? "my-auto" : "mt-auto"}`}>
        {STEPS.map((s, n) => {
          const state = finishing || n < step ? "done" : n === step ? "active" : "next";
          const active = state === "active";
          const picked = chosen[s.kind].length;
          const items = options[s.kind];
          return (
            <div key={s.kind} className={active ? "pb-1 pt-4" : "py-2"}>
              <div className={active ? "" : "flex items-center gap-2.5"}>
                <span data-flip={`icon-${s.kind}`} className="block w-fit origin-top-left transition-colors duration-500" style={{ color: active ? `rgb(var(--aura-${s.aura}))` : state === "done" ? "rgb(var(--ink) / 0.55)" : "rgb(var(--muted))" }}>
                  <Icon name={s.icon} className={active ? "h-7 w-7" : "h-[18px] w-[18px]"} />
                </span>
                <h2
                  data-flip={`title-${s.kind}`}
                  id={active ? "onboarding-title" : undefined}
                  className={`block w-fit origin-top-left ${active ? "mt-2.5 font-display text-[28px] font-bold leading-tight tracking-[-0.015em] text-ink" : `text-[15px] font-medium ${state === "done" ? "text-ink/60" : "text-muted"}`}`}
                >
                  {s.title}
                </h2>
                {state === "done" && picked > 0 && <span className="step-in text-[15px] text-ink/60">· {picked}</span>}
              </div>

              {active && (
                <div className="step-in">
                  <p className="mt-1.5 max-w-[19rem] text-[15px] leading-snug text-subtle">{s.text}</p>
                  <div ref={grid} onScroll={measure} data-more={more ? "" : undefined} data-less={less ? "" : undefined} className="pick-grid no-scrollbar -mx-6 mt-5 grid max-h-[min(24rem,46dvh)] grid-cols-4 gap-x-2 gap-y-4 overflow-y-auto overscroll-contain px-6 pb-3 pt-1 sm:grid-cols-6">
                    {items === null
                      ? Array.from({ length: 8 }).map((_, k) => <div key={k} className="mx-auto h-14 w-14 rounded-full shimmer" />)
                      : items.length === 0
                        ? <p className="col-span-4 text-[14px] text-subtle">Nothing to choose from right now. You can follow from any detail page later.</p>
                        : items.map((p) => {
                            const on = chosen[s.kind].includes(p.id);
                            return (
                              <button key={p.id} onClick={() => toggle(s.kind, p.id)} aria-pressed={on} className="press flex !min-h-0 flex-col items-center gap-1.5 text-center">
                                <span className={`relative transition-transform duration-300 ease-spring ${on ? "scale-105" : ""}`}>
                                  {p.ticker ? <CompanyLogo ticker={p.ticker} company={p.name} size={56} rounded="rounded-[16px]" /> : <Avatar name={p.name} src={p.src} kind={s.aura} size={56} />}
                                  <span className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] ring-2 ring-card transition-[transform,opacity] duration-300 ease-spring ${on ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} style={{ background: `rgb(var(--aura-${s.aura}))` }}>
                                    <Icon name="check" className="h-4 w-4" />
                                  </span>
                                </span>
                                <span className={`line-clamp-2 w-full text-[11px] leading-tight ${on ? "font-semibold text-ink" : "text-subtle"}`}>{p.name}</span>
                              </button>
                            );
                          })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {finishing && (
          <div className="step-in flex items-start gap-2.5 py-2" role="status">
            <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center">
              {ready ? (
                <span className="check-pop flex h-[18px] w-[18px] items-center justify-center rounded-full bg-bull-fill text-white">
                  <Icon name="check" className="h-3 w-3" />
                </span>
              ) : (
                <Mark size={18} spin />
              )}
            </span>
            <div key={ready ? "ready" : "busy"} className="step-in">
              <div id="onboarding-title" className={`text-[15px] font-semibold ${ready ? "text-ink" : "text-sweep"}`}>
                {ready ? "Outsider is ready!" : "Setting up Outsider"}
              </div>
              <div className="mt-0.5 max-w-[15rem] text-[14px] leading-snug text-subtle">
                {ready ? "Everything you follow is waiting on the home page." : "Hold tight while we fetch the latest filings for you."}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`relative px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 transition-opacity duration-300 ${finishing ? "pointer-events-none opacity-0" : ""}`}>
        <button onClick={advance} disabled={finishing} className="btn-primary w-full !min-h-[3.4rem] text-[17px] disabled:!opacity-100">
          <Icon name={current.icon} className="h-5 w-5" />
          {label}
        </button>
      </div>
    </div>
  );
}

function OnboardingInner() {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [phase, setPhase] = useState<"closed" | "welcome" | "setup">("closed");
  // How it came: the welcome fades in, the set-up alone rises like a sheet.
  const [entry, setEntry] = useState<"fade" | "rise">("fade");
  // How it goes: "Close" slides it down like a sheet, a finished set-up
  // fades (its content has already gone, so the page never shows through
  // half-drawn text).
  const [leaving, setLeaving] = useState<null | "slide" | "fade">(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(SEEN) === "1";
    } catch {
      /* private mode: show once per visit */
    }
    const ask = params.get("welcome") ?? params.get("willkommen");
    if (ask === "folgen") {
      setEntry("rise");
      setPhase("setup");
    } else if (ask === "1" || (path === "/" && !seen)) {
      setEntry("fade");
      setPhase("welcome");
    }
  }, [path, params]);

  const close = useCallback(
    (how: "slide" | "fade" = "slide") => {
      try {
        window.localStorage.setItem(SEEN, "1");
      } catch {
        /* ignore */
      }
      setLeaving(how);
      window.setTimeout(() => {
        setPhase("closed");
        setLeaving(null);
        if (params.get("welcome") || params.get("willkommen")) router.replace(path || "/", { scroll: false });
      }, reducedMotion() ? 0 : how === "slide" ? 420 : 320);
    },
    [params, path, router],
  );
  const slideAway = useCallback(() => close("slide"), [close]);
  const fadeAway = useCallback(() => close("fade"), [close]);

  useEffect(() => {
    if (phase === "closed") return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    // The dialog itself takes focus (for screen readers), not a button.
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && slideAway();
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, slideAway]);

  if (phase === "closed") return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className={`fixed inset-0 z-[70] flex justify-center transition-[opacity,background-color] duration-300 sm:items-center sm:p-6 ${leaving ? "bg-transparent" : "bg-black/30"} ${leaving === "fade" ? "opacity-0" : ""}`}
    >
      <div
        ref={panel}
        tabIndex={-1}
        data-entry={entry}
        className={`onboarding-panel relative h-[100dvh] w-full overflow-hidden bg-card text-ink outline-none sm:h-[min(52rem,92dvh)] sm:max-w-[26rem] sm:rounded-[2.75rem] sm:shadow-float ${leaving === "slide" ? "onboarding-slide-away" : ""}`}
      >
        {phase === "welcome" ? <Welcome onStart={() => setPhase("setup")} onSkip={slideAway} /> : <Setup onDone={fadeAway} onClose={slideAway} />}
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
