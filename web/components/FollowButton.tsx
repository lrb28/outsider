"use client";

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
    return () => window.removeEventListener("watchlist", sync);
  }, [kind, id]);

  const handle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOn(toggleFollow(kind, id));
  };

  if (variant === "star") {
    return (
      <button
        onClick={handle}
        aria-label={on ? "Nicht mehr folgen" : "Folgen"}
        className={`shrink-0 rounded-full px-1.5 text-lg leading-none transition ${
          on ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
        }`}
      >
        {on ? "★" : "☆"}
      </button>
    );
  }

  return (
    <button
      onClick={handle}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        on
          ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-200"
          : "bg-slate-900 text-white hover:bg-slate-800"
      }`}
    >
      {on ? "★ Folge ich" : "☆ Folgen"}
    </button>
  );
}
