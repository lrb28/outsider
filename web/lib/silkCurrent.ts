/*
 * The welcome screen's river (user, 2026-10-07: "my finger works like a big
 * stone in a river … if I remove the finger, the animation goes back to
 * normal"). The silk video itself is never altered: while a finger (or the
 * mouse) is on the screen, a WebGL2 canvas over the video draws the same
 * frames through a small fluid simulation, so the silk parts around the
 * finger, curls up behind it and follows it when it moves. Colours stay
 * exactly the video's; only where each pixel is read from changes.
 *
 * - A gentle current runs down the silk band, from the top right to the
 *   bottom left (`BAND`). Only the disturbance of that current is simulated
 *   (stable fluids: advection, vorticity confinement, pressure projection),
 *   so with nobody touching it dies away to nothing.
 * - A stone parts the strands as a cylinder parts a stream (drawn exactly,
 *   in the last pass), opening and closing on a spring. In the simulation it
 *   is a solid disc whose water moves with the finger, a softer halo drags
 *   the water along (the wake), and a stone that drops in pushes a small
 *   splash outwards.
 * - A displacement map (a flow map) records how far the disturbed water has
 *   drifted from where the plain current would have carried it, and each
 *   pixel shows the video at its own position plus that displacement. The
 *   map hangs on a damped spring, so after the last finger lifts the silk
 *   flows back with a slight overshoot, like water closing behind a stone.
 * - Once everything has settled the canvas hides and the plain video shows
 *   again: an untouched screen is exactly the video.
 */

type Source = HTMLVideoElement | HTMLImageElement;

export type SilkCurrent = {
  /** A finger or the mouse at `x`, `y` (0–1 across and down the canvas); a hovering mouse is a smaller stone. */
  move(id: number, x: number, y: number, hover?: boolean): void;
  /** That finger left; without an id, every one. */
  lift(id?: number): void;
  destroy(): void;
};

// The video's frame (public/welcome/silk-*.mp4 and the posters).
const VIDEO_W = 1170;
const VIDEO_H = 2538;

/*
 * The silk band in the video frame, from upstream (top right) to downstream
 * (bottom left): centre x, y as fractions of the frame, and its half width
 * in frame widths. Read off the poster.
 */
const BAND: [number, number, number][] = [
  [0.74, -0.06, 0.42],
  [0.82, 0.125, 0.32],
  [0.89, 0.25, 0.22],
  [0.94, 0.375, 0.15],
  [0.955, 0.475, 0.12],
  [0.93, 0.575, 0.13],
  [0.82, 0.675, 0.18],
  [0.61, 0.775, 0.24],
  [0.36, 0.86, 0.28],
  [0.11, 0.925, 0.3],
  [-0.2, 1.0, 0.3],
];

/* Lengths in screen widths, times in seconds. Fine-tuned on an iPhone-sized panel. */
const TUNING = {
  cells: 112, // simulation cells across the screen
  flowCells: 224, // displacement map cells across
  pressureIterations: 22,
  current: 0.32, // speed of the current along the band
  offBand: 0.2, // share of that speed beside the band
  stone: 0.1, // stone radius; the mouse hovers at `hover` of it until pressed
  hover: 0.72,
  halo: 1.4, // wake halo, in stone radii
  drag: 5, // how fast water in the halo takes the stone's speed (per s)
  part: 1, // how far the strands part around a stone (1: as water around a cylinder)
  partSpring: 15, // the parting opens and closes on a spring (rad/s)
  partDamping: 0.5,
  splash: 0.9, // outward push when a stone drops in
  curl: 6, // vorticity confinement
  viscosity: 0.2, // smooths the smallest eddies away
  keep: 0.7, // velocity damping per s while touched
  release: 2.2, // velocity damping per s once released
  spring: 18, // displacement spring stiffness while touched
  springBack: 30, // and once released
  springDamping: 5.6,
  gain: 1.1, // displacement per distance the disturbance moved
  maxShift: 0.34,
  settle: 2.8, // seconds after the last lift until the plain video shows
};

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
`;

// Moves the disturbance with the whole current (disturbance plus band).
const ADVECT = `${HEAD}
uniform sampler2D uVel;
uniform sampler2D uCur;
uniform vec2 uScale;
uniform float uDt;
uniform float uKeep;
void main() {
  vec2 v = texture(uVel, vUv).xy + texture(uCur, vUv).xy;
  o = vec4(texture(uVel, vUv - uDt * v * uScale).xy * uKeep, 0.0, 1.0);
}`;

const CURL = `${HEAD}
uniform sampler2D uVel;
uniform vec2 uTexel;
void main() {
  float l = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y;
  float r = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
  float t = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
  float b = texture(uVel, vUv - vec2(0.0, uTexel.y)).x;
  o = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}`;

// Vorticity confinement, then the stones: drag halo, splash, solid core.
const FORCES = `${HEAD}
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform sampler2D uCur;
uniform vec2 uTexel;
uniform vec2 uScale;
uniform float uDt;
uniform float uCurlK;
uniform float uVisc;
uniform float uDrag;
uniform float uHalo;
uniform int uCount;
uniform vec4 uStone[4];  // x, y (uv), vx, vy (widths per s)
uniform vec4 uStoneB[4]; // radius (widths), strength 0-1, splash
void main() {
  float l = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float t = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float b = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float c = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  f *= uCurlK * c / (length(f) + 1e-4);
  f.y = -f.y;
  vec2 u = texture(uVel, vUv).xy;
  vec2 around = 0.25 * (texture(uVel, vUv - vec2(uTexel.x, 0.0)).xy + texture(uVel, vUv + vec2(uTexel.x, 0.0)).xy + texture(uVel, vUv - vec2(0.0, uTexel.y)).xy + texture(uVel, vUv + vec2(0.0, uTexel.y)).xy);
  u = mix(u, around, uVisc) + f * uDt;
  vec2 band = texture(uCur, vUv).xy;
  for (int i = 0; i < 4; i++) {
    if (i >= uCount) break;
    vec2 d = (vUv - uStone[i].xy) / uScale;
    float dist = length(d);
    float rad = uStoneB[i].x;
    float s = uStoneB[i].y;
    vec2 still = uStone[i].zw - band; // the disturbance that makes water move with the stone
    float halo = exp(-dist * dist / (rad * rad * uHalo * uHalo));
    u = mix(u, still, clamp(halo * s * uDrag * uDt, 0.0, 1.0));
    u += d / (dist + 1e-4) * uStoneB[i].z * exp(-dist * dist / (rad * rad * 1.8)) * smoothstep(0.0, 0.6 * rad, dist);
    u = mix(u, still, s * (1.0 - smoothstep(0.72 * rad, rad, dist)));
  }
  o = vec4(u, 0.0, 1.0);
}`;

const DIVERGENCE = `${HEAD}
uniform sampler2D uVel;
uniform vec2 uTexel;
void main() {
  float l = texture(uVel, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uVel, vUv + vec2(uTexel.x, 0.0)).x;
  float t = texture(uVel, vUv + vec2(0.0, uTexel.y)).y;
  float b = texture(uVel, vUv - vec2(0.0, uTexel.y)).y;
  o = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}`;

// The river runs on beyond the screen: open edges, pressure 0 outside.
const OPEN = `
float p(sampler2D tex, vec2 uv) {
  return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ? 0.0 : texture(tex, uv).x;
}`;

const PRESSURE = `${HEAD}${OPEN}
uniform sampler2D uP;
uniform sampler2D uDiv;
uniform vec2 uTexel;
void main() {
  float l = p(uP, vUv - vec2(uTexel.x, 0.0));
  float r = p(uP, vUv + vec2(uTexel.x, 0.0));
  float t = p(uP, vUv + vec2(0.0, uTexel.y));
  float b = p(uP, vUv - vec2(0.0, uTexel.y));
  o = vec4(0.25 * (l + r + t + b - texture(uDiv, vUv).x), 0.0, 0.0, 1.0);
}`;

const GRADIENT = `${HEAD}${OPEN}
uniform sampler2D uP;
uniform sampler2D uVel;
uniform vec2 uTexel;
void main() {
  float l = p(uP, vUv - vec2(uTexel.x, 0.0));
  float r = p(uP, vUv + vec2(uTexel.x, 0.0));
  float t = p(uP, vUv + vec2(0.0, uTexel.y));
  float b = p(uP, vUv - vec2(0.0, uTexel.y));
  o = vec4(texture(uVel, vUv).xy - 0.5 * vec2(r - l, t - b), 0.0, 1.0);
}`;

const SCALE = `${HEAD}
uniform sampler2D uP;
uniform float uK;
void main() { o = texture(uP, vUv) * uK; }`;

/*
 * The flow map: displacement (xy) and its spring's velocity (zw), carried by
 * the whole current. The disturbance pushes the displacement, the spring
 * pulls it home.
 */
const FLOW = `${HEAD}
uniform sampler2D uFlow;
uniform sampler2D uVel;
uniform sampler2D uCur;
uniform vec2 uScale;
uniform float uDt;
uniform float uSpring;
uniform float uDamp;
uniform float uGain;
uniform float uMax;
void main() {
  vec2 v = texture(uVel, vUv).xy;
  vec4 f = texture(uFlow, vUv - uDt * (v + texture(uCur, vUv).xy) * uScale);
  vec2 w = f.zw * uDamp - uSpring * f.xy * uDt;
  vec2 d = f.xy + (w - uGain * v) * uDt;
  float n = length(d);
  if (n > uMax) d *= uMax / n;
  o = vec4(d, w);
}`;

/*
 * The video, read through the flow map and parted around each stone, framed
 * like object-fit: cover. The parting is a cylinder in potential flow: a
 * point beside the stone shows the strand that, upstream, ran at
 * b·(1 − R²/ρ²) from the stone's centre line, so the strands split around
 * it and close behind it; under the stone the centre strand spreads out.
 */
const DISPLAY = `${HEAD}
uniform sampler2D uFlow;
uniform sampler2D uVideo;
uniform vec2 uScale;
uniform vec2 uCover;
uniform float uAmount;
uniform int uCount;
uniform vec4 uPart[4];  // x, y (uv), direction of the strands
uniform vec4 uPartB[4]; // radius (widths), opening
void main() {
  vec2 shift = texture(uFlow, vUv).xy;
  for (int i = 0; i < 4; i++) {
    if (i >= uCount) break;
    vec2 d = (vUv - uPart[i].xy) / uScale;
    vec2 n = vec2(-uPart[i].w, uPart[i].z);
    float rad2 = uPartB[i].x * uPartB[i].x;
    float rho2 = dot(d, d);
    shift -= n * dot(d, n) * rad2 / max(rho2, rad2) * exp(-rho2 / (rad2 * 14.0)) * uPartB[i].y;
  }
  vec2 t = 0.5 + (vUv + shift * uScale * uAmount - 0.5) * uCover;
  o = vec4(texture(uVideo, vec2(t.x, 1.0 - t.y)).rgb, 1.0);
}`;

type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };
type Pair = { read: Target; write: Target; swap(): void };
type Program = { prog: WebGLProgram; loc: Map<string, WebGLUniformLocation | null> };

type Stone = {
  id: number;
  x: number; // uv, y up
  y: number;
  px: number;
  py: number;
  vx: number; // widths per s
  vy: number;
  s: number;
  down: boolean;
  size: number;
  goal: number;
  kick: number;
  open: number; // how far the strands have parted (a spring, so it overshoots a little)
  openV: number;
  ex: number; // direction of the strands at the stone
  ey: number;
};

export function createSilkCurrent(canvas: HTMLCanvasElement, source: () => Source | null): SilkCurrent | null {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl || gl.isContextLost()) return null;
  if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  let programs: Record<"advect" | "curl" | "forces" | "divergence" | "pressure" | "gradient" | "scale" | "flow" | "display", Program>;
  try {
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const link = (src: string): Program => {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, vertex);
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, src));
      gl.bindAttribLocation(prog, 0, "aPos");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "program");
      return { prog, loc: new Map() };
    };
    programs = {
      advect: link(ADVECT),
      curl: link(CURL),
      forces: link(FORCES),
      divergence: link(DIVERGENCE),
      pressure: link(PRESSURE),
      gradient: link(GRADIENT),
      scale: link(SCALE),
      flow: link(FLOW),
      display: link(DISPLAY),
    };
  } catch {
    return null;
  }

  // One triangle over the whole target.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  const texture = (w: number, h: number, data: Float32Array | null = null) => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    return tex;
  };
  const target = (w: number, h: number): Target => {
    const tex = texture(w, h);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo, w, h };
  };
  const pair = (w: number, h: number): Pair => {
    const p = {
      read: target(w, h),
      write: target(w, h),
      swap() {
        const t = p.read;
        p.read = p.write;
        p.write = t;
      },
    };
    return p;
  };
  const free = (t: Target) => {
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
  };
  // Some GPUs list the extension yet cannot draw into half floats.
  const probe = target(4, 4);
  const drawable = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  free(probe);
  if (!drawable) return null;

  // Mirrored at its edges: silk pulled in from beyond the frame continues
  // instead of smearing the last row of pixels.
  const video = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, video);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  // Sized by `fit`.
  let width = 0;
  let height = 0;
  let aspect = 1;
  let cover: [number, number] = [1, 1];
  let vel: Pair | null = null;
  let pressure: Pair | null = null;
  let flow: Pair | null = null;
  let curl: Target | null = null;
  let divergence: Target | null = null;
  let current: WebGLTexture | null = null;
  let band: Float32Array | null = null;
  let bandW = 0;
  let bandH = 0;

  const bandField = (w: number, h: number) => {
    const va = VIDEO_W / VIDEO_H;
    const pts = BAND.map(([x, y, hw]) => [x, y / va, hw] as const);
    const data = new Float32Array(w * h * 4);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        // This cell in the video frame, in frame widths, y down.
        const px = 0.5 + ((i + 0.5) / w - 0.5) * cover[0];
        const py = (1 - (0.5 + ((j + 0.5) / h - 0.5) * cover[1])) / va;
        let dx = 0;
        let dy = 0;
        let near = Infinity;
        let half = 0.2;
        for (let k = 0; k < pts.length - 1; k++) {
          const [ax, ay, ah] = pts[k];
          const [bx, by, bh] = pts[k + 1];
          const sx = bx - ax;
          const sy = by - ay;
          const len = Math.hypot(sx, sy);
          const t = Math.max(0, Math.min(1, ((px - ax) * sx + (py - ay) * sy) / (len * len)));
          const d = Math.hypot(px - ax - sx * t, py - ay - sy * t);
          // Tangents of nearby segments blend, so the current turns smoothly.
          const wgt = Math.exp(-((d / 0.12) ** 2)) + 1e-6;
          dx += (sx / len) * wgt;
          dy += (sy / len) * wgt;
          if (d < near) {
            near = d;
            half = ah + (bh - ah) * t;
          }
        }
        const n = Math.hypot(dx, dy) || 1;
        const edge = Math.min(1, Math.max(0, (near - half * 0.7) / (half * 0.9)));
        const speed = TUNING.current * (TUNING.offBand + (1 - TUNING.offBand) * (1 - edge * edge * (3 - 2 * edge)));
        const o = (j * w + i) * 4;
        data[o] = (dx / n) * speed;
        data[o + 1] = (-dy / n) * speed; // y up
        data[o + 2] = dx / n; // and the bare direction, for the parting
        data[o + 3] = -dy / n;
      }
    }
    return data;
  };

  const fit = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w === width && h === height) return;
    width = canvas.width = w;
    height = canvas.height = h;
    aspect = rect.width / rect.height;
    const va = VIDEO_W / VIDEO_H;
    cover = aspect > va ? [1, va / aspect] : [aspect / va, 1];
    for (const p of [vel, pressure, flow]) if (p) (free(p.read), free(p.write));
    for (const t of [curl, divergence]) if (t) free(t);
    if (current) gl.deleteTexture(current);
    const sw = TUNING.cells;
    const sh = Math.max(8, Math.round(sw / aspect));
    const fw = TUNING.flowCells;
    const fh = Math.max(8, Math.round(fw / aspect));
    vel = pair(sw, sh);
    pressure = pair(sw, sh);
    curl = target(sw, sh);
    divergence = target(sw, sh);
    flow = pair(fw, fh);
    band = bandField(sw, sh);
    bandW = sw;
    bandH = sh;
    current = texture(sw, sh, band);
  };

  const run = (p: Program, out: Target | null, textures: Record<string, WebGLTexture>, uniforms: Record<string, number | number[] | Float32Array | Int32Array> = {}) => {
    gl.useProgram(p.prog);
    const at = (name: string) => {
      if (!p.loc.has(name)) p.loc.set(name, gl.getUniformLocation(p.prog, name));
      return p.loc.get(name)!;
    };
    let unit = 0;
    for (const [name, tex] of Object.entries(textures)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(at(name), unit++);
    }
    for (const [name, v] of Object.entries(uniforms)) {
      const l = at(name);
      if (typeof v === "number") gl.uniform1f(l, v);
      else if (v instanceof Int32Array) gl.uniform1i(l, v[0]);
      else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
      else gl.uniform4fv(l, v);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fbo : null);
    gl.viewport(0, 0, out ? out.w : width, out ? out.h : height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const stones: Stone[] = [];
  const stoneA = new Float32Array(16);
  const stoneB = new Float32Array(16);
  let released = false;

  const step = (dt: number) => {
    if (!vel || !pressure || !flow || !curl || !divergence || !current) return;
    const scale = [1, aspect];
    const texel = [1 / vel.read.w, 1 / vel.read.h];
    const touched = stones.some((s) => s.down);

    run(programs.advect, vel.write, { uVel: vel.read.tex, uCur: current }, { uScale: scale, uDt: dt, uKeep: Math.exp(-dt * (touched ? TUNING.keep : TUNING.release)) });
    vel.swap();

    const count = Math.min(stones.length, 4);
    stoneA.fill(0);
    stoneB.fill(0);
    for (let i = 0; i < count; i++) {
      const s = stones[i];
      stoneA.set([s.x, s.y, s.vx, s.vy], i * 4);
      stoneB.set([TUNING.stone * s.size, s.s, s.kick], i * 4);
      s.kick = 0;
    }
    run(programs.curl, curl, { uVel: vel.read.tex }, { uTexel: texel });
    run(programs.forces, vel.write, { uVel: vel.read.tex, uCurl: curl.tex, uCur: current }, {
      uTexel: texel,
      uScale: scale,
      uDt: dt,
      uCurlK: TUNING.curl,
      uVisc: TUNING.viscosity,
      uDrag: TUNING.drag,
      uHalo: TUNING.halo,
      uCount: new Int32Array([count]),
      uStone: stoneA,
      uStoneB: stoneB,
    });
    vel.swap();

    run(programs.divergence, divergence, { uVel: vel.read.tex }, { uTexel: texel });
    run(programs.scale, pressure.write, { uP: pressure.read.tex }, { uK: 0.8 });
    pressure.swap();
    for (let i = 0; i < TUNING.pressureIterations; i++) {
      run(programs.pressure, pressure.write, { uP: pressure.read.tex, uDiv: divergence.tex }, { uTexel: texel });
      pressure.swap();
    }
    run(programs.gradient, vel.write, { uP: pressure.read.tex, uVel: vel.read.tex }, { uTexel: texel });
    vel.swap();

    run(programs.flow, flow.write, { uFlow: flow.read.tex, uVel: vel.read.tex, uCur: current }, {
      uScale: scale,
      uDt: dt,
      uSpring: released ? TUNING.springBack : TUNING.spring,
      uDamp: Math.exp(-dt * TUNING.springDamping),
      uGain: TUNING.gain,
      uMax: TUNING.maxShift,
    });
    flow.swap();
  };

  const partA = new Float32Array(16);
  const partB = new Float32Array(16);
  const draw = (amount: number) => {
    if (!flow) return;
    const count = Math.min(stones.length, 4);
    partA.fill(0);
    partB.fill(0);
    for (let i = 0; i < count; i++) {
      const s = stones[i];
      partA.set([s.x, s.y, s.ex, s.ey], i * 4);
      partB.set([TUNING.stone * s.size, s.open * TUNING.part], i * 4);
    }
    run(programs.display, null, { uFlow: flow.read.tex, uVideo: video }, {
      uScale: [1, aspect],
      uCover: cover,
      uAmount: amount,
      uCount: new Int32Array([count]),
      uPart: partA,
      uPartB: partB,
    });
  };

  // The strands' direction under a stone, from the band field.
  const strands = (s: Stone, k: number) => {
    if (!band) return;
    const i = Math.min(bandW - 1, Math.max(0, Math.floor(s.x * bandW)));
    const j = Math.min(bandH - 1, Math.max(0, Math.floor(s.y * bandH)));
    const o = (j * bandW + i) * 4;
    s.ex += (band[o + 2] - s.ex) * k;
    s.ey += (band[o + 3] - s.ey) * k;
    const n = Math.hypot(s.ex, s.ey) || 1;
    s.ex /= n;
    s.ey /= n;
  };

  // The video's newest frame, or the poster once.
  let shownSource: Source | null = null;
  let shownTime = -1;
  const upload = (force: boolean) => {
    const src = source();
    if (!src) return false;
    const time = src instanceof HTMLVideoElement ? src.currentTime : 0;
    if (!force && src === shownSource && time === shownTime) return true;
    gl.bindTexture(gl.TEXTURE_2D, video);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } catch {
      return false;
    }
    shownSource = src;
    shownTime = time;
    return true;
  };

  let raf = 0;
  let running = false;
  let visible = false;
  let quiet = 0;
  let last = 0;
  let dead = false;

  const sleep = () => {
    running = false;
    cancelAnimationFrame(raf);
    canvas.style.opacity = "";
    visible = false;
    for (const p of [vel, pressure, flow]) {
      if (!p) continue;
      for (const t of [p.read, p.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
  };

  const tick = (now: number) => {
    const dt = Math.min(Math.max((now - last) / 1000, 0.001), 1 / 30);
    last = now;
    const follow = 1 - Math.exp(-dt / 0.035);
    for (let i = stones.length - 1; i >= 0; i--) {
      const s = stones[i];
      // Speed from how far it moved since the last frame, smoothed a little.
      s.vx += ((s.x - s.px) / dt - s.vx) * follow;
      s.vy += ((s.y - s.py) / aspect / dt - s.vy) * follow;
      s.px = s.x;
      s.py = s.y;
      s.s += ((s.down ? 1 : 0) - s.s) * (1 - Math.exp(-dt / (s.down ? 0.07 : 0.1)));
      s.size += (s.goal - s.size) * (1 - Math.exp(-dt / 0.1));
      const w = TUNING.partSpring;
      s.openV += (w * w * ((s.down ? 1 : 0) - s.open) - 2 * TUNING.partDamping * w * s.openV) * dt;
      s.open += s.openV * dt;
      strands(s, 1 - Math.exp(-dt / 0.12));
      if (!s.down && s.s < 0.01 && Math.abs(s.open) < 0.004 && Math.abs(s.openV) < 0.04) stones.splice(i, 1);
    }
    const touched = stones.some((s) => s.down);
    if (touched) {
      quiet = 0;
      released = false;
    } else {
      quiet += dt;
      released = true;
    }
    if (quiet > TUNING.settle) return sleep();
    upload(false);
    // Two half steps when frames are slow, so the water behaves the same.
    if (dt > 1 / 50) {
      step(dt / 2);
      step(dt / 2);
    } else step(dt);
    const t = Math.min(1, Math.max(0, (quiet - (TUNING.settle - 0.6)) / 0.6));
    draw(1 - t * t * (3 - 2 * t));
    if (!visible) {
      canvas.style.opacity = "1";
      visible = true;
    }
    raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (running || dead) return;
    fit();
    if (!vel || !upload(true)) return;
    running = true;
    quiet = 0;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const resize = new ResizeObserver(() => {
    if (!running) return;
    fit();
  });
  resize.observe(canvas);
  const lost = (e: Event) => {
    e.preventDefault();
    dead = true;
    running = false;
    cancelAnimationFrame(raf);
    canvas.style.opacity = "";
  };
  canvas.addEventListener("webglcontextlost", lost);

  return {
    move(id, x, y, hover = false) {
      if (dead) return;
      const uy = 1 - y;
      const goal = hover ? TUNING.hover : 1;
      let s = stones.find((st) => st.id === id);
      // A finger landing, or the mouse pressing, drops the stone in: splash.
      const drop = !hover && (!s || !s.down || s.goal < 1);
      if (!s) {
        if (stones.length >= 4) return;
        s = { id, x, y: uy, px: x, py: uy, vx: 0, vy: 0, s: 0, down: true, size: goal, goal, kick: 0, open: 0, openV: 0, ex: 0, ey: -1 };
        strands(s, 1);
        stones.push(s);
      }
      s.x = x;
      s.y = uy;
      s.down = true;
      s.goal = goal;
      if (drop) s.kick = TUNING.splash;
      wake();
    },
    lift(id) {
      for (const s of stones) if (id === undefined || s.id === id) s.down = false;
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      resize.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
