"use client";

import { useEffect, useRef, useState } from "react";

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

  const video = useRef<HTMLVideoElement>(null);
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

  if (!mode) return null;
  const base = `/welcome/silk-${mode}`;
  return (
    <div aria-hidden="true" className={`silk-video ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" />
      {!still && (
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
      )}
    </div>
  );
}
