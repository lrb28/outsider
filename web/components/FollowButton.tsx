"use client";

import { Icon } from "@/components/Icon";

import { useEffect, useState } from "react";

import { FollowKind, isFollowed, toggleFollow } from "@/lib/watchlist";

export function FollowButton({
  kind,
  id,
  variant = "button",
}: {
  kind: FollowKind;
  id: string;
  variant?: "button" | "star";
}) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(isFollowed(kind, id));
    sync();
    window.addEventListener("watchlist", sync);
    window.addEventListener("storage", sync);
    return () => {window.removeEventListener("watchlist", sync);window.removeEventListener("storage", sync);};
  }, [kind, id]);

  const handle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { setOn(toggleFollow(kind, id)); } catch { /* StorageNotice reports the failed write. */ }
  };

  if (variant === "star") {
    return (
      <button
        onClick={handle}
        aria-pressed={on}
        aria-label={on ? "Nicht mehr folgen" : "Folgen"}
        className={`h-11 w-11 shrink-0 rounded-full px-1.5 text-lg leading-none transition ${
          on ? "text-amber-500" : "text-zinc-400 hover:text-amber-500"
        }`}
      >
        <Icon name="star" className={`h-5 w-5 ${on ? "[&_path]:fill-current" : ""}`} />
      </button>
    );
  }

  return (
    <button
      onClick={handle}
        aria-pressed={on}
      className={`press-sm inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold ${
        on
          ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-200"
          : "btn-primary !px-4 !py-1.5"
      }`}
    >
      <Icon name="star" className={`h-4 w-4 ${on ? "[&_path]:fill-current" : ""}`} />
      {on ? "Folge ich" : "Folgen"}
    </button>
  );
}
