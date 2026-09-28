"use client";

import { Avatar } from "./Avatar";

// Overlapping row of investor portraits (like the Eaves stock list).
export function FaceStack({ names, size = 26 }: { names: string[]; size?: number }) {
  const shown = names.slice(0, 3);
  return (
    <div className="flex items-center">
      {shown.map((n, i) => (
        <div
          key={n + i}
          style={{ marginLeft: i === 0 ? 0 : -size * 0.32, zIndex: shown.length - i }}
          className="rounded-full shadow-[0_2px_10px_rgb(0_0_0/0.16)]"
        >
          <Avatar name={n} size={size} />
        </div>
      ))}
    </div>
  );
}
