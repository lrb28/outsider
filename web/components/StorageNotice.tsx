"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
export function StorageNotice() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const show = (event: Event) => setMessage((event as CustomEvent<string>).detail || "This browser can’t save data. Please export a backup of your portfolio.");
    window.addEventListener("storage-error", show);
    return () => window.removeEventListener("storage-error", show);
  }, []);
  return message ? <div role="alert" className="mx-auto flex max-w-5xl items-center gap-4 bg-warn/10 px-4 py-3 text-sm text-warn"><p className="flex-1">{message}</p><button aria-label="Dismiss" onClick={() => setMessage("")} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-warn/15"><Icon name="close" className="h-5 w-5" /></button></div> : null;
}
