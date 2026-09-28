"use client";

import { type CSSProperties, type ElementType, type ReactNode, useEffect, useRef } from "react";

/*
 * Liquid glass in WebGL, ported from dashersw/liquid-glass-js (MIT, © 2025
 * Armagan Amcalar): the page is rendered once into a texture with html2canvas,
 * and a fragment shader samples it behind each glass surface with edge
 * refraction, a blur and a light tint.
 *
 * Changes for a Next.js app: one shared snapshot for every surface, captured
 * only around the viewport and refreshed after navigation, content changes
 * and scrolling; glass surfaces stay in the layout during capture (hidden,
 * not removed); refraction in CSS pixels; a lighter blur kernel; CSS glass
 * stays underneath as the fallback without WebGL or with reduced transparency.
 */

type Snapshot = { canvas: HTMLCanvasElement; left: number; top: number; scale: number; version: number };
const SCALE = 0.5;
const state = {
  snap: null as Snapshot | null,
  listeners: new Set<() => void>(),
  capturing: false,
  pending: false,
  timer: 0 as unknown as ReturnType<typeof setTimeout>,
  observer: null as MutationObserver | null,
  surfaces: 0,
};

function notify() {
  state.listeners.forEach(fn => fn());
}

async function capture() {
  if (state.capturing) {
    state.pending = true;
    return;
  }
  state.capturing = true;
  try {
    const { default: html2canvas } = await import("html2canvas");
    const vh = window.innerHeight;
    const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const top = Math.max(0, Math.floor(window.scrollY - vh * 0.5));
    const height = Math.min(docHeight - top, Math.ceil(vh * 2));
    const canvas = await html2canvas(document.body, {
      x: 0,
      y: top,
      width: document.documentElement.clientWidth,
      height,
      scale: SCALE,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#f2f2f7",
      windowWidth: document.documentElement.clientWidth,
      windowHeight: vh,
      // Glass surfaces must not see themselves, but they keep their space so
      // the rest of the page does not shift in the snapshot.
      onclone: doc => doc.querySelectorAll<HTMLElement>("[data-liquid-glass], [data-liquid-glass-skip]").forEach(el => (el.style.visibility = "hidden")),
    });
    state.snap = { canvas, left: 0, top, scale: SCALE, version: (state.snap?.version ?? 0) + 1 };
    notify();
  } catch (error) {
    // Keep the previous snapshot; the CSS glass underneath stays visible.
    if (process.env.NODE_ENV !== "production") console.warn("[liquid-glass] capture failed", error);
  } finally {
    state.capturing = false;
    if (state.pending) {
      state.pending = false;
      schedule(300);
    }
  }
}

function schedule(delay = 700) {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (idle) idle(() => void capture(), { timeout: 1500 });
    else void capture();
  }, delay);
}

function outOfSnapshot() {
  const s = state.snap;
  if (!s) return true;
  const height = s.canvas.height / s.scale;
  return window.scrollY < s.top + 80 && s.top > 0 ? true : window.scrollY + window.innerHeight > s.top + height - 80;
}

function startWatching() {
  if (state.observer) return;
  state.observer = new MutationObserver(records => {
    // Ignore changes inside glass surfaces (active tab, hover) — only content matters.
    if (records.some(r => !(r.target instanceof Element && r.target.closest("[data-liquid-glass]")))) schedule(800);
  });
  state.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  let scrollTimer: ReturnType<typeof setTimeout>;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => outOfSnapshot() && schedule(0), 120);
  }, { passive: true });
  window.addEventListener("resize", () => schedule(300));
  window.addEventListener("load", () => schedule(200));
  schedule(400);
}

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_size;        // surface size, CSS px
uniform float u_radius;     // corner radius, CSS px
uniform vec2 u_center;      // surface centre in the viewport, CSS px
uniform vec2 u_scroll;      // window scroll, CSS px
uniform vec2 u_origin;      // snapshot origin on the page, CSS px
uniform float u_scale;      // snapshot pixels per CSS px
uniform vec2 u_texSize;     // snapshot size, px
uniform float u_blur;       // blur radius, CSS px
uniform float u_tint;       // white tint
uniform float u_px;         // one device pixel in CSS px (anti-aliasing)
varying vec2 v_uv;

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 hs = u_size * 0.5;
  float r = min(u_radius, min(hs.x, hs.y));
  vec2 p = (v_uv - 0.5) * u_size;
  float d = sdRoundRect(p, hs, r);
  vec2 e = vec2(0.75, 0.0);
  vec2 n = vec2(sdRoundRect(p + e.xy, hs, r) - sdRoundRect(p - e.xy, hs, r),
                sdRoundRect(p + e.yx, hs, r) - sdRoundRect(p - e.yx, hs, r));
  n = normalize(n + 1e-5);
  float inside = max(-d, 0.0);

  // Liquid lens: the rim bends the page behind it towards the centre, the
  // middle stays almost undistorted.
  float rim = exp(-inside * 0.55);
  float edge = exp(-inside * 0.12);
  vec2 bend = -n * (rim * 10.0 + edge * 5.0);
  vec2 page = u_center + p + u_scroll + bend;
  vec2 uv = (page - u_origin) * u_scale / u_texSize;

  vec4 acc = vec4(0.0);
  float total = 0.0;
  vec2 stepUv = vec2(u_blur * u_scale / 3.0) / u_texSize;
  for (float i = -3.0; i <= 3.0; i += 1.0) {
    for (float j = -3.0; j <= 3.0; j += 1.0) {
      float w = exp(-(i * i + j * j) / 8.0);
      acc += texture2D(u_image, uv + vec2(i, j) * stepUv) * w;
      total += w;
    }
  }
  vec3 color = acc.rgb / total;

  // Brighter, slightly saturated glass with a cool top-to-bottom tint.
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, 1.25);
  vec3 tint = mix(vec3(1.0), vec3(0.93, 0.94, 0.96), v_uv.y);
  color = mix(color, tint, u_tint);

  // Specular rim, lit from the top left, and a faint inner shadow below.
  float light = clamp(dot(n, normalize(vec2(-0.55, -1.0))), 0.0, 1.0);
  color += vec3(1.0) * rim * (0.22 + 0.55 * light);
  color -= vec3(0.06) * exp(-inside * 0.9) * clamp(dot(n, vec2(0.0, 1.0)), 0.0, 1.0);

  float mask = 1.0 - smoothstep(-u_px, u_px, d);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0) * mask, mask);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
  return shader;
}

function supportsLiveGlass() {
  if (typeof window === "undefined") return false;
  if (matchMedia("(prefers-reduced-transparency: reduce)").matches) return false;
  try {
    return !!document.createElement("canvas").getContext("webgl");
  } catch {
    return false;
  }
}

export function LiquidGlass({
  as: Tag = "div",
  radius,
  tint = 0.28,
  blur = 7,
  className = "",
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  radius?: number;
  tint?: number;
  blur?: number;
  className?: string;
  style?: CSSProperties;
  role?: string;
  children: ReactNode;
} & Partial<Record<`aria-${string}` | `data-${string}`, string>>) {
  const host = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = host.current;
    const canvas = canvasRef.current;
    if (!el || !canvas || !supportsLiveGlass()) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.warn("[liquid-glass] shader failed", error);
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const loc = { size: u("u_size"), radius: u("u_radius"), center: u("u_center"), scroll: u("u_scroll"), origin: u("u_origin"), scale: u("u_scale"), texSize: u("u_texSize"), blur: u("u_blur"), tint: u("u_tint"), px: u("u_px") };
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.clearColor(0, 0, 0, 0);

    let version = 0;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const snap = state.snap;
      if (!snap) return;
      if (snap.version !== version) {
        try {
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snap.canvas);
          version = snap.version;
        } catch {
          return;
        }
      }
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      const cornerRadius = radius ?? parseFloat(getComputedStyle(el).borderTopLeftRadius) ?? 24;
      gl.uniform2f(loc.size, rect.width, rect.height);
      gl.uniform1f(loc.radius, cornerRadius);
      gl.uniform2f(loc.center, rect.left + rect.width / 2, rect.top + rect.height / 2);
      gl.uniform2f(loc.scroll, window.scrollX, window.scrollY);
      gl.uniform2f(loc.origin, snap.left, snap.top);
      gl.uniform1f(loc.scale, snap.scale);
      gl.uniform2f(loc.texSize, snap.canvas.width, snap.canvas.height);
      gl.uniform1f(loc.blur, blur);
      gl.uniform1f(loc.tint, tint);
      gl.uniform1f(loc.px, 1 / dpr);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      el.dataset.glassLive = "";
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    state.listeners.add(request);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    const resize = new ResizeObserver(request);
    resize.observe(el);
    state.surfaces += 1;
    startWatching();
    request();
    return () => {
      state.listeners.delete(request);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      resize.disconnect();
      cancelAnimationFrame(frame);
      state.surfaces -= 1;
      delete el.dataset.glassLive;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [radius, tint, blur]);

  return (
    <Tag ref={host} data-liquid-glass="" className={`liquid-glass ${className}`} style={style} {...rest}>
      <canvas ref={canvasRef} aria-hidden="true" className="liquid-glass-canvas" />
      {children}
    </Tag>
  );
}

/** Re-captures the page behind the glass after client-side navigation. */
export function refreshLiquidGlass(delay = 500) {
  if (state.surfaces > 0) schedule(delay);
}
