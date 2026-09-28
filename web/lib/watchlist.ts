// Tiny client-side watchlist backed by localStorage. Works in the deployed app
// (this is a real Next.js site, not a sandboxed artifact). Emits a "watchlist"
// window event on change so components can re-render.

export type FollowKind = "investor" | "stock" | "politician";

const KEY = (k: FollowKind) => `outsider:follow:${k}`;

function read(k: FollowKind): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(KEY(k)) || "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 160))].slice(0,500) : [];
  } catch {
    return [];
  }
}

function write(k: FollowKind, v: string[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (error) {
    window.dispatchEvent(new CustomEvent("storage-error", {detail:"Die Watchlist konnte nicht gespeichert werden. Prüfe den freien Speicher und deine Browsereinstellungen."}));
    throw error;
  }
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
