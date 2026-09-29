"use client";

import { useEffect, useRef } from "react";

/*
 * The welcome screen's backdrop: a band of iridescent silk that flows from
 * the top right, pinches at the right edge and sweeps out to the bottom
 * left, gently folding as it moves (after the reference wallet app's first
 * screen). Drawn by a WebGL shader: each pixel finds its place on the band
 * (along it and across it) from a centreline that drifts in a six-second
 * loop, lays three translucent layers of thin-film colour over each other
 * and darkens them where the silk turns away. Dark mode is the negative of
 * the light picture, exactly like the reference: orange turns teal and the
 * creases turn into bright glints.
 *
 * Decoration only: aria-hidden, reduced resolution, paused off screen and in
 * background tabs, one still frame for reduced motion, a CSS gradient when
 * WebGL is unavailable.
 */

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const POINTS = 40;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_time;
uniform float u_dark;
uniform vec2 u_pts[${POINTS}];
varying vec2 v_uv;

// Thin-film colours on silk, in order: pink, orange, yellow, pale cyan,
// blue, violet (then round again), with no muddy green in between.
vec3 film(float h) {
  h = fract(h) * 6.0;
  vec3 c0 = vec3(1.0, 0.56, 0.78);
  vec3 c1 = vec3(1.0, 0.56, 0.22);
  vec3 c2 = vec3(1.0, 0.88, 0.38);
  vec3 c3 = vec3(0.45, 0.9, 1.0);
  vec3 c4 = vec3(0.22, 0.45, 1.0);
  vec3 c5 = vec3(0.62, 0.4, 1.0);
  float f = fract(h);
  f = f * f * (3.0 - 2.0 * f);
  if (h < 1.0) return mix(c0, c1, f);
  if (h < 2.0) return mix(c1, c2, f);
  if (h < 3.0) return mix(c2, c3, f);
  if (h < 4.0) return mix(c3, c4, f);
  if (h < 5.0) return mix(c4, c5, f);
  return mix(c5, c0, f);
}

void main() {
  // x across the screen, y down it, both in screen widths.
  vec2 p = vec2(v_uv.x, (1.0 - v_uv.y) * u_res.y / u_res.x);

  // Nearest point on the centreline: how far along the band (s) and how far
  // across it, with the side it lies on.
  float best = 1e9;
  float s = 0.0;
  float side = 1.0;
  for (int i = 0; i < ${POINTS - 1}; i++) {
    vec2 a = u_pts[i];
    vec2 ab = u_pts[i + 1] - a;
    vec2 ap = p - a;
    float t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
    float d = length(ap - ab * t);
    if (d < best) {
      best = d;
      s = (float(i) + t) / ${(POINTS - 1).toFixed(1)};
      side = sign(ab.x * ap.y - ab.y * ap.x);
    }
  }
  float T = u_time * 6.28318 / 6.0;
  // Wide at the top, pinched at the right edge, wide again below.
  float x = clamp(abs(s - 0.44) / 0.56, 0.0, 1.0);
  float w = 0.09 + 0.26 * x * x * (3.0 - 2.0 * x) + 0.14 * x;
  float u = side * best / w;

  // Softer behind the headline (bottom left).
  float calm = 1.0 - 0.5 * smoothstep(1.3, 1.75, p.y) * (1.0 - smoothstep(0.55, 0.95, p.x));
  vec3 light = vec3(1.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float ui = (u - (fk - 1.0) * 0.4) / (0.8 - 0.12 * fk);
    float fold = sin(s * 7.0 + fk * 2.1 - T + ui * 1.0) * 0.6 + sin(s * 15.0 - fk * 1.3 + T + ui * 0.6) * 0.16;
    float uu = ui + fold * 0.4;
    float a = smoothstep(1.0, 0.15, abs(uu));
    // Broad soft bands; the fine threads are only hinted at.
    a *= 0.55 + 0.45 * sin(uu * 5.0 + fold * 3.0 + fk * 1.7 + s * 4.0);
    a = clamp(a, 0.0, 1.0);
    float threads = mix(0.86, 1.0, pow(0.5 + 0.5 * sin(uu * 40.0 + fold * 6.0 + fk), 2.0));
    float facing = 0.5 + 0.5 * cos(fold * 2.6 + uu * 1.2 + fk * 0.8);
    // One spectrum across each layer, from pink at its left edge over
    // orange and yellow to blue at its right, bent by the folds.
    float hue = pow(clamp((uu + 1.0) * 0.5, 0.0, 1.0), 1.35) * 0.7 - 0.02 + s * 0.1 + fold * 0.08 + fk * 0.05;
    vec3 c = film(hue);
    // Where the silk turns away it deepens into a blue crease.
    float crease = smoothstep(0.3, 0.0, facing);
    vec3 lc = mix(c, vec3(0.12, 0.22, 0.78), crease * 0.7);
    lc = mix(lc, lc * lc, 0.4 * (1.0 - facing));
    lc = mix(lc, vec3(1.0), 0.06 * facing);
    light = mix(light, lc, a * 0.9 * threads * calm);
    float spec = pow(max(0.0, cos(fold * 3.0 + uu * 1.8 - 0.5 + fk)), 24.0) * a;
    light = mix(light, vec3(1.0), spec * 0.6);
  }
  gl_FragColor = vec4(mix(light, vec3(1.0) - light, u_dark), 1.0);
}`;

// Centreline control points (x across, y down, in screen widths).
const BASE: [number, number][] = [
  [0.48, -0.3], [0.64, 0.08], [0.8, 0.5], [0.92, 0.86], [0.93, 1.1],
  [0.8, 1.34], [0.54, 1.56], [0.24, 1.78], [-0.08, 2.02], [-0.4, 2.28],
];

function catmull(p0: number[], p1: number[], p2: number[], p3: number[], t: number, k: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
}

/** The drifting centreline at `time` (seconds), sampled into POINTS points. */
function centreline(time: number, out: Float32Array) {
  const T = (time * Math.PI * 2) / 6;
  const c = BASE.map(([x, y], i) => [x + 0.022 * Math.sin(T + i * 0.9), y + 0.018 * Math.cos(T + i * 1.3)]);
  const segs = c.length - 1;
  for (let j = 0; j < POINTS; j++) {
    const g = (j / (POINTS - 1)) * segs;
    const i = Math.min(segs - 1, Math.floor(g));
    const t = g - i;
    const p0 = c[Math.max(0, i - 1)];
    const p3 = c[Math.min(c.length - 1, i + 2)];
    out[j * 2] = catmull(p0, c[i], c[i + 1], p3, t, 0);
    out[j * 2 + 1] = catmull(p0, c[i], c[i + 1], p3, t, 1);
  }
  return out;
}

export function SilkRibbon({ className = "", scale = 0.7 }: { className?: string; /** Render resolution relative to CSS pixels. */ scale?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power", preserveDrawingBuffer: false });
    const fail = () => {
      canvas.dataset.fallback = "";
    };
    if (!gl) return fail();
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return fail();
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return fail();
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const loc = { res: gl.getUniformLocation(program, "u_res"), time: gl.getUniformLocation(program, "u_time"), dark: gl.getUniformLocation(program, "u_dark"), pts: gl.getUniformLocation(program, "u_pts") };

    const scheme = matchMedia("(prefers-color-scheme: dark)");
    const theme = () => {
      const forced = document.documentElement.dataset.theme;
      gl.uniform1f(loc.dark, forced ? (forced === "dark" ? 1 : 0) : scheme.matches ? 1 : 0);
    };
    theme();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pts = new Float32Array(POINTS * 2);
    const start = performance.now();
    let frame = 0;
    let visible = true;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * scale));
      const h = Math.max(1, Math.round(r.height * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(loc.res, w, h);
    };
    const draw = (now: number) => {
      frame = 0;
      const t = reduced ? 1.5 : (now - start) / 1000;
      gl.uniform1f(loc.time, t);
      gl.uniform2fv(loc.pts, centreline(t, pts));
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
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      kick();
    });
    io.observe(canvas);
    const onScheme = () => {
      theme();
      kick();
    };
    scheme.addEventListener("change", onScheme);
    document.addEventListener("visibilitychange", kick);
    resize();
    kick();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      scheme.removeEventListener("change", onScheme);
      document.removeEventListener("visibilitychange", kick);
      // Free the GPU objects but keep the context: losing it for good broke
      // the canvas when the effect ran again on the same element.
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [scale]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`silk-ribbon ${className}`} />;
}
