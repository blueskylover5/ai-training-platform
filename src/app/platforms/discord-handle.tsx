"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type CopyState = "idle" | "copied" | "selected";

/**
 * CON-05: Discord has no link that opens a chat from a username, so the contact section shows the
 * username with a copy button. With a numeric user ID, the username also links to the profile.
 */
export function DiscordHandle({ username, profileUrl, icon }: { username: string; profileUrl: string | null; icon: ReactNode }) {
  const [state, setState] = useState<CopyState>("idle");
  const nameRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(username);
      setState("copied");
    } catch {
      // The clipboard can be blocked (an insecure page or browser settings): select the name instead.
      const name = nameRef.current;
      if (name) window.getSelection()?.selectAllChildren(name);
      setState("selected");
    }
  }

  const nameClass = "font-semibold break-all select-all";
  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-3xl border border-line-strong bg-surface py-2 pr-2 pl-6 text-base text-ink sm:w-auto sm:rounded-full">
      {icon}
      <span className="font-semibold">Message us on Discord:</span>
      {profileUrl ? (
        <a ref={(el) => void (nameRef.current = el)} href={profileUrl} target="_blank" rel="noopener noreferrer" className={nameClass}>
          {username}
        </a>
      ) : (
        <span ref={(el) => void (nameRef.current = el)} className={nameClass}>
          {username}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy the Discord username ${username}`}
        className="ml-auto inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-sm font-semibold text-ink hover:border-ink"
      >
        {state === "copied" ? "Copied" : state === "selected" ? "Selected" : "Copy"}
      </button>
      <span role="status" className="sr-only">
        {state === "copied" ? `Copied ${username}` : state === "selected" ? `Selected ${username}. Copy it from here.` : ""}
      </span>
    </div>
  );
}
