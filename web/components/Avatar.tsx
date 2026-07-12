"use client";

import { useEffect, useState } from "react";

import { avatarColor, initials, wikiTitleFor } from "@/lib/format";

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
  const [photo, setPhoto] = useState<string | null>(title ? cache.get(title) ?? null : null);

  useEffect(() => {
    let on = true;
    if (title) fetchPhoto(title).then((s) => on && setPhoto(s));
    return () => {
      on = false;
    };
  }, [title]);

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
        className={`shrink-0 rounded-full bg-white object-cover ring-1 ring-hair ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-hair ${avatarColor(
        name,
      )} ${className}`}
    >
      <span style={{ fontSize: Math.round(size * 0.36) }}>{initials(name)}</span>
    </div>
  );
}
