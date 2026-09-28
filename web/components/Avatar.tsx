"use client";

import { useEffect, useState } from "react";

import { avatarColor, initials, wikiTitleFor } from "@/lib/format";
import { PORTRAITS } from "@/lib/portraits";

// Module-level cache so a portrait is fetched from Wikipedia at most once per
// session, no matter how many avatars reference the same person.
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function fetchPhoto(title: string): Promise<string | null> {
  if (cache.has(title)) return Promise.resolve(cache.get(title) ?? null);
  if (inflight.has(title)) return inflight.get(title)!;
  const p = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const src: string | null = d?.thumbnail?.source ?? null;
      cache.set(title, src);
      inflight.delete(title);
      return src;
    })
    .catch(() => {
      cache.set(title, null);
      inflight.delete(title);
      return null;
    });
  inflight.set(title, p);
  return p;
}

export function Avatar({
  name,
  size = 36,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const title = wikiTitleFor(name);
  // Curated, credited portraits first; other known people via Wikipedia.
  const known = title ? PORTRAITS[title]?.src ?? null : null;
  const [photo, setPhoto] = useState<string | null>(known ?? (title ? cache.get(title) ?? null : null));

  useEffect(() => {
    let on = true;
    if (known) setPhoto(known);
    else if (title) fetchPhoto(title).then((s) => on && setPhoto(s));
    return () => {
      on = false;
    };
  }, [title, known]);

  const style = { width: size, height: size, minWidth: size } as const;

  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        loading="lazy"
        style={style}
        onError={() => {
          if (title) cache.set(title, null);
          setPhoto(null);
        }}
        className={`shrink-0 rounded-full bg-zinc-100 object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${avatarColor(
        name,
      )} ${className}`}
    >
      <span style={{ fontSize: Math.round(size * 0.36) }}>{initials(name)}</span>
    </div>
  );
}
