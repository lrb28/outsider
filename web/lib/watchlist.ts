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
    window.dispatchEvent(new CustomEvent("storage-error", {detail:"The watchlist couldn’t be saved. Check the free storage and your browser settings."}));
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

/** Someone in the people row of "Your watchlist": an investor or a politician. */
export type WatchedPerson = { kind: "investor" | "politician"; slug: string; name: string; photo: string | null };

/**
 * The people row of "Your watchlist" on Home, in its order: the followed
 * investors, then the followed politicians, each in the catalogue's order.
 * The watchlist pager swipes through the same row.
 */
export function watchedPeople(
  investors: { slug: string; fund: string; person: string | null }[],
  politicians: { slug: string; name: string; photo?: string | null }[],
  followed: { investor: string[]; politician: string[] },
): WatchedPerson[] {
  const inv = followed.investor;
  const pol = followed.politician;
  return [
    ...investors.filter((i) => inv.includes(i.slug)).map((i) => ({ kind: "investor" as const, slug: i.slug, name: i.person ?? i.fund, photo: null })),
    ...politicians.filter((p) => pol.includes(p.slug)).map((p) => ({ kind: "politician" as const, slug: p.slug, name: p.name, photo: p.photo ?? null })),
  ];
}

/** Query that marks a person's page as opened from "Your watchlist". */
export const FROM_WATCHLIST = "from=watchlist";

export function personHref(p: { kind: WatchedPerson["kind"]; slug: string }, fromWatchlist = false): string {
  return `/${p.kind}/${encodeURIComponent(p.slug)}${fromWatchlist ? `?${FROM_WATCHLIST}` : ""}`;
}

/** Who a person's URL names ("/politician/nancy-pelosi"), if anyone. */
export function personFromPath(path: string): { kind: WatchedPerson["kind"]; slug: string } | null {
  const [, kind, slug] = path.split("/");
  if ((kind !== "investor" && kind !== "politician") || !slug) return null;
  return { kind, slug: decodeURIComponent(slug) };
}
