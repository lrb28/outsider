"use client";

import { type CSSProperties, type ElementType, type ReactNode, useEffect, useId, useRef, useState } from "react";

/*
 * Liquid Glass for the navigation layer.
 *
 * Every browser gets the CSS glass in globals.css (.liquid-glass): a clear,
 * saturated backdrop blur with a lit rim. Chromium can also run an SVG filter
 * as a backdrop-filter, so there the page behind the glass is refracted live:
 * a displacement map bends the backdrop at the rounded edge like a convex
 * lens, splits the channels slightly (the faint rainbow fringe of real glass)
 * and keeps the middle clear. The map is generated for the element's exact
 * size and radius and regenerated when it resizes. No snapshots, no delay.
 *
 * Safari and Firefox ignore SVG backdrop filters, and people who ask for
 * reduced transparency get the plain material, so the effect is only
 * switched on where it renders.
 */

function supportsRefraction() {
  if (typeof window === "undefined") return false;
  if (matchMedia("(prefers-reduced-transparency: reduce)").matches) return false;
  const ua = navigator.userAgent;
  // iOS browsers are all WebKit, whatever they are called.
  if (/iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS/.test(ua)) return false;
  return /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua);
}

/** Signed distance from p to a rounded rectangle centred at 0 (negative inside) and its outward normal. */
function roundRect(px: number, py: number, hw: number, hh: number, r: number) {
  const qx = Math.abs(px) - hw + r;
  const qy = Math.abs(py) - hh + r;
  const sx = px < 0 ? -1 : 1;
  const sy = py < 0 ? -1 : 1;
  if (qx > 0 && qy > 0) {
    const len = Math.hypot(qx, qy);
    return { d: len - r, nx: (qx / len) * sx, ny: (qy / len) * sy };
  }
  if (qx > qy) return { d: Math.max(qx, qy) - r, nx: sx, ny: 0 };
  return { d: Math.max(qx, qy) - r, nx: 0, ny: sy };
}

/**
 * Displacement map: red = x offset, green = y offset, 128 = none. Inside the
 * bezel the sample point moves inwards along the normal with a convex
 * (squircle-like) profile, so the backdrop is magnified towards the rim.
 */
function displacementMap(w: number, h: number, radius: number, bezel: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(radius, hw, hh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const { d, nx, ny } = roundRect(x + 0.5 - hw, y + 0.5 - hh, hw, hh, r);
      const inside = -d;
      let dx = 0;
      let dy = 0;
      if (inside >= 0 && inside < bezel) {
        const t = 1 - inside / bezel; // 1 at the rim, 0 where the bezel ends
        const m = Math.pow(t, 2.2); // convex lens profile
        dx = -nx * m;
        dy = -ny * m;
      }
      const i = (y * w + x) * 4;
      img.data[i] = Math.round(128 + dx * 127);
      img.data[i + 1] = Math.round(128 + dy * 127);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function LiquidGlass({
  as: Tag = "div",
  radius = 999,
  bezel = 16,
  strength = 26,
  className = "",
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  /** Corner radius in px (999 = capsule). */
  radius?: number;
  /** Width of the refracting rim in px. */
  bezel?: number;
  /** Maximum displacement in px at the very edge. */
  strength?: number;
  className?: string;
  style?: CSSProperties;
  role?: string;
  children: ReactNode;
} & Partial<Record<`aria-${string}` | `data-${string}`, string>>) {
  const id = `lg-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const host = useRef<HTMLElement>(null);
  const [map, setMap] = useState<{ href: string; w: number; h: number } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || !supportsRefraction()) return;
    let frame = 0;
    const build = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 8 || h < 8 || w * h > 600_000) return;
      const r = Math.min(radius, h / 2, w / 2);
      const href = displacementMap(w, h, r, Math.min(bezel, h / 2));
      if (href) setMap({ href, w, h });
    };
    const ro = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(build);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [radius, bezel]);

  const live = map !== null;
  const glassStyle: CSSProperties = live
    ? { ...style, backdropFilter: `url(#${id})`, WebkitBackdropFilter: `url(#${id})` }
    : { ...style };

  return (
    <Tag ref={host} data-liquid-glass="" data-refract={live ? "" : undefined} className={`liquid-glass ${className}`} style={glassStyle} {...rest}>
      {live && (
        <svg aria-hidden="true" width="0" height="0" className="pointer-events-none absolute" style={{ position: "absolute", width: 0, height: 0 }}>
          <filter id={id} x="0" y="0" width={map.w} height={map.h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="soft" />
            <feImage href={map.href} x="0" y="0" width={map.w} height={map.h} preserveAspectRatio="none" result="map" />
            {/* Red, green and blue bend by slightly different amounts. */}
            <feDisplacementMap in="soft" in2="map" scale={strength * 2} xChannelSelector="R" yChannelSelector="G" result="dr" />
            <feDisplacementMap in="soft" in2="map" scale={strength * 1.9} xChannelSelector="R" yChannelSelector="G" result="dg" />
            <feDisplacementMap in="soft" in2="map" scale={strength * 1.8} xChannelSelector="R" yChannelSelector="G" result="db" />
            <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feBlend in="r" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b" mode="screen" result="rgb" />
            <feColorMatrix in="rgb" type="saturate" values="1.7" />
          </filter>
        </svg>
      )}
      {children}
    </Tag>
  );
}
