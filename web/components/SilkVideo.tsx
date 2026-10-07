"use client";

import { useEffect, useRef, useState } from "react";

import { createSilkCurrent, type SilkCurrent } from "@/lib/silkCurrent";

/*
 * The welcome screen's backdrop: the silk animation from the user's
 * reference videos, 1:1 (2026-09-30: "1 zu 1 die animation von dem video
 * hochauflösend"). Made from the two videos (light and dark): cropped to
 * the phone screen, the clock, logo, headline and buttons painted out, the
 * five copies of its one-second loop averaged into one clean loop, upscaled
 * to 1170×2538 (3× an iPhone) and played three times per file.
 * Source frames and steps: docs/brand.md, "Welcome screen".
 *
 * HEVC for Apple devices, H.264 for the rest, a still poster until the
 * video plays (and for reduced motion, or when Low Power Mode blocks
 * autoplay). Decoration only: aria-hidden.
 *
 * A finger on the screen is a stone in the silk's river (user, 2026-10-07):
 * while it touches, a canvas over the video draws the same frames through a
 * small fluid simulation (lib/silkCurrent), then hides again once the silk
 * has flowed back. The mouse does the same while it hovers. Not for reduced
 * motion.
 */

type Mode = "light" | "dark";

function currentMode(): Mode {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function SilkVideo({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [still, setStill] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const update = () => setMode(currentMode());
    update();
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", update);
    window.addEventListener("aura:theme", update);
    return () => {
      scheme.removeEventListener("change", update);
      window.removeEventListener("aura:theme", update);
    };
  }, []);

  const root = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const playingRef = useRef(false);
  playingRef.current = playing;
  // Autoplay can start before React attaches its handlers, so the element is
  // asked directly, and nudged in case autoplay was held back.
  useEffect(() => {
    setPlaying(false);
    const v = video.current;
    if (!v) return;
    const on = () => {
      if (!v.paused && v.currentTime > 0) setPlaying(true);
    };
    on();
    v.addEventListener("playing", on);
    v.addEventListener("timeupdate", on);
    v.play().catch(() => {
      /* Low Power Mode or a blocked autoplay: the poster stays */
    });
    return () => {
      v.removeEventListener("playing", on);
      v.removeEventListener("timeupdate", on);
    };
  }, [mode, still]);

  // The river. Listens on the screen the backdrop sits in, which takes no
  // panning (touch-none), so a dragging finger is never cancelled.
  useEffect(() => {
    const c = canvas.current;
    const surface = root.current?.parentElement;
    if (!mode || still || !c || !surface) return;
    // The frames the canvas shows: the playing video, else the poster.
    const source = () => {
      const v = video.current;
      if (v && playingRef.current && v.readyState >= 2) return v;
      const p = poster.current;
      return p && p.complete && p.naturalWidth ? p : null;
    };
    let river: SilkCurrent | null | undefined;
    const ensure = () => (river === undefined ? (river = createSilkCurrent(c, source)) : river);
    // Compiled shortly after the screen has come in, not on the first touch.
    const timer = window.setTimeout(ensure, 700);
    const at = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as const;
    };
    const move = (e: PointerEvent) => {
      // Touch only moves while down; a mouse or a hovering pencil hovers.
      if (e.pointerType === "touch" && e.type === "pointermove" && !e.buttons) return;
      const [x, y] = at(e);
      ensure()?.move(e.pointerId, x, y, e.pointerType !== "touch" && !e.buttons);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType === "touch") return river?.lift(e.pointerId);
      move(e);
    };
    const lift = (e: PointerEvent) => river?.lift(e.pointerId);
    // Switching apps or windows can swallow the finger's "up".
    const calm = () => river?.lift();
    surface.addEventListener("pointerdown", move);
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerup", up);
    surface.addEventListener("pointercancel", lift);
    surface.addEventListener("pointerleave", lift);
    window.addEventListener("blur", calm);
    document.addEventListener("visibilitychange", calm);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", calm);
      document.removeEventListener("visibilitychange", calm);
      surface.removeEventListener("pointerdown", move);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerup", up);
      surface.removeEventListener("pointercancel", lift);
      surface.removeEventListener("pointerleave", lift);
      river?.destroy();
    };
  }, [mode, still]);

  if (!mode) return null;
  const base = `/welcome/silk-${mode}`;
  return (
    <div ref={root} aria-hidden="true" className={`silk-video ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={poster} src={`${base}.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" />
      {!still && (
        <>
          <video
            key={mode}
            ref={video}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            poster={`${base}.jpg`}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${playing ? "opacity-100" : "opacity-0"}`}
          >
            <source src={`${base}-hevc.mp4`} type='video/mp4; codecs="hvc1"' />
            <source src={`${base}.mp4`} type="video/mp4" />
          </video>
          {/* Shown by lib/silkCurrent only while the silk is disturbed. */}
          <canvas key={`${mode}-river`} ref={canvas} className="absolute inset-0 h-full w-full opacity-0" />
        </>
      )}
    </div>
  );
}
