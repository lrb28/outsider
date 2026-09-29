"use client";

import { useEffect, useRef } from "react";

/*
 * The welcome screen's backdrop, after the reference wallet app's first
 * screen (the user's two videos, light and dark): a ribbon of iridescent
 * silk that enters wide at the top right, pinches at the right edge and fans
 * out into separate strands towards the bottom left. A WebGL shader finds
 * each pixel's place on the ribbon (along it and across it) from a
 * centreline that drifts in an eight-second loop, then lays five strands of
 * thin film over white. The films multiply like tinted glass, so where they
 * overlap they deepen into amber and navy, as in the reference; one spectrum
 * runs across the band (cream, pink, orange, blue, cyan), fine threads run
 * along it, and each strand's edges split slightly into red and blue. Dark
 * mode is the negative of that picture, exactly like the reference (orange
 * turns teal, blue turns gold), plus white glints on the lower strands.
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

float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f);
}

// The colours of a thin film on silk, in the order the reference shows them
// across the band: cream yellow, pink, orange, blue, cyan, lilac.
vec3 film(float h) {
  h = fract(h) * 6.0;
  vec3 c0 = vec3(1.0, 0.9, 0.5);
  vec3 c1 = vec3(1.0, 0.64, 0.86);
  vec3 c2 = vec3(1.0, 0.6, 0.2);
  vec3 c3 = vec3(0.14, 0.38, 1.0);
  vec3 c4 = vec3(0.3, 0.85, 1.0);
  vec3 c5 = vec3(0.7, 0.52, 1.0);
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
  vec2 p = vec2(v_uv.x, (1.0 - v_uv.y) * u_res.y / u_res.x);

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
  float d = side * best;
  float T = u_time * 6.28318 / 8.0;

  // Band shape along its length: wide at the top, pinched at the right
  // edge, fanning out into separate strands towards the bottom left.
  float toPinch = smoothstep(0.06, 0.44, s);
  float fan = smoothstep(0.44, 0.8, s);
  float spread = mix(mix(0.13, 0.02, toPinch), 0.12, fan);
  float width = mix(mix(0.32, 0.035, toPinch), 0.045, fan);
  // Across the band: -1 at its upper left edge, +1 at its lower right.
  float across = clamp(-d / (1.3 * spread + 0.6 * width), -1.0, 1.0);
  float crisp = smoothstep(0.3, 0.6, s);

  // A soft cream and pink haze along the upper left edge of the band.
  float hz = (d - (2.2 * spread + 0.5 * width)) / (0.55 * width + 0.06);
  float haze = exp(-hz * hz) * (1.0 - smoothstep(0.08, 0.3, s)) * 0.5;
  vec3 col = mix(vec3(1.0), mix(vec3(1.0, 0.93, 0.7), vec3(1.0, 0.8, 0.88), clamp(hz * 0.5 + 0.5, 0.0, 1.0)), haze);
  float glint = 0.0;
  for (int k = 0; k < 5; k++) {
    float fk = float(k) - 2.0;
    float c = fk * spread + 0.016 * sin(s * 9.0 + fk * 1.7 + T);
    float w = width * (1.0 + 0.35 * sin(fk * 2.3 + 1.0));
    float phase = s * 9.0 + fk * 1.3 - T * 1.2;
    float face = abs(cos(phase));
    float we = w * (0.35 + 0.65 * face);
    float q = (d - c) / we;
    float soft = mix(0.7, 0.3, crisp);
    vec3 qq = abs(q) * vec3(1.07, 1.0, 0.93);
    vec3 a = 1.0 - smoothstep(1.0 - soft, 1.0, qq);
    float hollow = mix(1.0, 0.25 + 0.75 * smoothstep(0.15, 0.95, abs(q)), fan);
    float dens = mix(1.0, 0.7, face) * hollow;
    float n = noise(q * 7.0 + fk * 5.3 + s * 1.2) * (0.5 + 0.5 * noise(q * 27.0 + fk * 2.1 + s * 3.0));
    // Smooth, lightly brushed silk at the top; separate threads below.
    float str = mix(0.7 + 0.3 * n, 0.35 + 0.65 * n, crisp);
    // One spectrum across the whole band, left to right: cream, pink,
    // orange, blue, cyan; each strand shifts it a little.
    float hue = (across + 1.0) * 0.36 + fk * 0.07 - q * 0.04 + s * 0.05 + 0.03 * sin(T * 0.7 + fk);
    // Fine iridescent threads running along the silk.
    hue += 0.05 * sin(q * 23.0 + fk * 3.1 + s * 6.0);
    vec3 alpha = clamp(a * dens * str, 0.0, 1.0);
    col *= mix(vec3(1.0), film(hue), alpha);
    glint += pow(max(0.0, 1.0 - abs(q)), 6.0) * pow(max(0.0, sin(s * 23.0 + fk * 2.0 - T * 2.0)), 40.0) * fan;
  }
  vec3 dark = vec3(1.0) - col;
  dark += vec3(glint) * 0.9;
  gl_FragColor = vec4(mix(col, dark, u_dark), 1.0);
}`;

// Centreline control points (x across, y down, in screen widths).
const BASE: [number, number][] = [
  [0.6, -0.4], [0.7, 0.26], [0.8, 0.64], [0.88, 1.0], [0.9, 1.2],
  [0.8, 1.4], [0.62, 1.6], [0.38, 1.78], [0.1, 1.96], [-0.2, 2.15],
];

function catmull(p0: number[], p1: number[], p2: number[], p3: number[], t: number, k: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
}

/** The drifting centreline at `time` (seconds), sampled into POINTS points. */
function centreline(time: number, out: Float32Array) {
  const T = (time * Math.PI * 2) / 8;
  const c = BASE.map(([x, y], i) => [x + 0.02 * Math.sin(T + i * 0.9), y + 0.016 * Math.cos(T + i * 1.3)]);
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
    window.addEventListener("aura:theme", onScheme);
    document.addEventListener("visibilitychange", kick);
    resize();
    kick();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      scheme.removeEventListener("change", onScheme);
      window.removeEventListener("aura:theme", onScheme);
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
