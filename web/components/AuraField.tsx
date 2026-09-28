"use client";

import { useEffect, useRef } from "react";

/*
 * The aura: a slowly flowing colour field in the three identity colours
 * (investors blue, insiders orange, politicians magenta) with faint
 * iridescent bands, drawn by a small WebGL shader. It is decoration only:
 * aria-hidden, rendered at reduced resolution, paused off screen and in
 * background tabs, frozen for reduced motion, and replaced by a CSS gradient
 * when WebGL is unavailable.
 */

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_focus;   // weights for c1..c3 (onboarding steps)
uniform float u_bright; // 1 in light mode, lifts the pastel
varying vec2 v_uv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = (v_uv - 0.5) * vec2(u_res.x / u_res.y, 1.0) * 0.75;
  float t = u_time * 0.04;
  vec2 q = vec2(fbm(p * 1.1 + t), fbm(p * 1.1 - t + 3.1));
  vec2 r = vec2(fbm(p * 1.3 + q * 1.4 + vec2(1.7, 9.2) + t * 1.2), fbm(p * 1.3 + q * 1.4 + vec2(8.3, 2.8) - t));
  float f = fbm(p * 0.9 + r * 1.6);

  // Three auras, weighted towards the focused one.
  float w1 = u_focus.x * (1.0 - smoothstep(0.25, 0.75, r.x));
  float w2 = u_focus.y * smoothstep(0.3, 0.8, r.x);
  float w3 = u_focus.z * smoothstep(0.35, 0.85, r.y);
  vec3 col = (u_c1 * w1 + u_c2 * w2 + u_c3 * w3) / max(w1 + w2 + w3, 0.001);
  // Keep the mix saturated: averaging hues greys them out.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(l), col, 1.45), 0.0, 1.0);

  // Thin-film sheen: narrow bright bands that drift with the flow.
  float band = sin((f * 1.4 + r.x) * 16.0 - t * 9.0) * 0.5 + 0.5;
  col = mix(col, vec3(1.0), pow(band, 14.0) * 0.4);
  col = mix(col, vec3(1.0), u_bright * 0.12);

  float a = smoothstep(0.22, 0.7, f + 0.2 * r.y);
  gl_FragColor = vec4(col * a, a);
}`;

function rgb(name: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map(Number);
  return raw.length === 3 && raw.every((n) => Number.isFinite(n)) ? [raw[0] / 255, raw[1] / 255, raw[2] / 255] : [0.5, 0.5, 0.5];
}

export function AuraField({
  className = "",
  focus = [1, 1, 1],
  scale = 0.5,
  vivid = false,
}: {
  className?: string;
  /** Weight of investor, insider and politician colour. */
  focus?: [number, number, number];
  /** Render resolution relative to CSS pixels. */
  scale?: number;
  /** Full-strength colours in light mode too (text sits on top in white). */
  vivid?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const focusRef = useRef(focus);
  const target = useRef(focus);
  target.current = focus;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) {
      canvas.dataset.fallback = "";
      return;
    }
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) {
      canvas.dataset.fallback = "";
      return;
    }
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      canvas.dataset.fallback = "";
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(program, n);
    const loc = { res: u("u_res"), time: u("u_time"), c1: u("u_c1"), c2: u("u_c2"), c3: u("u_c3"), focus: u("u_focus"), bright: u("u_bright") };

    const palette = () => {
      gl.uniform3fv(loc.c1, rgb("--aura-investor"));
      gl.uniform3fv(loc.c2, rgb("--aura-insider"));
      gl.uniform3fv(loc.c3, rgb("--aura-politician"));
      const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
      gl.uniform1f(loc.bright, vivid || dark ? 0 : 1);
    };
    palette();
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", palette);

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    let frame = 0;
    let last = 0;
    const start = performance.now() - Math.random() * 40_000;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * scale));
      const h = Math.max(1, Math.round(rect.height * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(loc.res, w, h);
    };
    const draw = (now: number) => {
      frame = 0;
      // ~30 fps is plenty for a slow field.
      if (!reduced && now - last < 33) {
        frame = requestAnimationFrame(draw);
        return;
      }
      last = now;
      const f = focusRef.current;
      const g = target.current;
      focusRef.current = [f[0] + (g[0] - f[0]) * 0.06, f[1] + (g[1] - f[1]) * 0.06, f[2] + (g[2] - f[2]) * 0.06];
      gl.uniform3fv(loc.focus, focusRef.current);
      gl.uniform1f(loc.time, (now - start) / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.dataset.live = "";
      if (!reduced && visible && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", kick);
    resize();
    kick();
    // Reduced motion: one still frame, redrawn only when the focus changes.
    const focusTimer = reduced ? window.setInterval(kick, 400) : 0;
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", kick);
      scheme.removeEventListener("change", palette);
      window.clearInterval(focusTimer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [scale, vivid]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`aura-field ${className}`} />;
}
