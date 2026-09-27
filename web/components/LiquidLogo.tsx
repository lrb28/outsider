"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Paper Shaders' liquid-metal material (Apache-2.0), the engine behind
// paper-design/liquid-logo, applied to the Outsider mark: a ring and the one
// sphere that sits outside it.
const LiquidMetal = dynamic(() => import("@paper-design/shaders-react").then(m => m.LiquidMetal), { ssr: false });

function supportsWebGl2() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export function LiquidLogo({ size = 36, className = "" }: { size?: number; className?: string }) {
  const [live, setLive] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    setLive(supportsWebGl2());
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(motion.matches);
    sync();
    motion.addEventListener("change", sync);
    return () => motion.removeEventListener("change", sync);
  }, []);
  return (
    <span aria-hidden="true" className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {/* Static chrome mark underneath: visible until the shader has processed the
          mark, and the whole time without WebGL. The shader covers it exactly. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-static.svg" alt="" width={size} height={size} className="absolute inset-0 h-full w-full" />
      {live && (
        <LiquidMetal
          image="/logo-mark.svg"
          colorBack="#00000000"
          colorTint="#ffffff"
          repetition={2}
          softness={0.1}
          shiftRed={0.3}
          shiftBlue={0.3}
          distortion={0.07}
          contour={0.4}
          angle={70}
          fit="contain"
          scale={1}
          speed={still ? 0 : 0.6}
          minPixelRatio={2}
          maxPixelCount={size * size * 9}
          style={{ width: size, height: size }}
          className="absolute inset-0"
        />
      )}
    </span>
  );
}
