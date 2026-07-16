// Tiny client-side watchlist backed by localStorage. Works in the deployed app
// (this is a real Next.js site, not a sandboxed artifact). Emits a "watchlist"
// window event on change so components can re-render.

export type FollowKind = "investor" | "stock";

const KEY = (k: FollowKind) => `outsider:follow:${k}`;

function read(k: FollowKind): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY(k)) || "[]");
  } catch {
    return [];
  }
}

function write(k: FollowKind, v: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY(k), JSON.stringify(v));
  window.dispatchEvent(new CustomEvent("watchlist", { detail: { kind: k } }));
}

export function getFollowed(k: FollowKind): string[] {
  return read(k);
}

export function isFollowed(k: FollowKind, id: string): boolean {
  return read(k).includes(id);
}

export function toggleFollow(k: FollowKind, id: string): boolean {
  const cur = read(k);
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  write(k, next);
  return next.includes(id);
}
