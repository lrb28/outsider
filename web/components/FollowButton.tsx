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
        aria-label={on ? "Unfollow" : "Follow"}
        className={`h-11 w-11 shrink-0 rounded-full px-1.5 text-lg leading-none transition ${
          on ? "text-warn" : "text-zinc-400 hover:text-warn"
        }`}
      >
        <Icon name="star" className={`h-5 w-5 ${on ? "[&_path]:fill-current" : ""}`} />
      </button>
    );
  }

  return (
    <button onClick={handle} aria-pressed={on} className={on ? "btn-capsule !min-h-10 !px-4 !text-[14px]" : "btn-primary !min-h-10 !px-4 !text-[14px]"}>
      {on ? <Icon name="tick" className="h-4 w-4" /> : <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>}
      {on ? "Following" : "Follow"}
    </button>
  );
}
