"use client";

import type { AgentEvent, SessionState } from "./types";

export function AgentStrip({
  event,
  sessionState,
}: {
  event: AgentEvent;
  sessionState: SessionState;
}) {
  let label = "Listening to lecture";
  let dotColor = "bg-zinc-400 dark:bg-zinc-500";
  let pulse = true;

  if (sessionState === "ended") {
    label = "Session ended";
    dotColor = "bg-zinc-300 dark:bg-zinc-700";
    pulse = false;
  } else if (sessionState === "finalizing") {
    label =
      event.kind === "calling" ? event.label : "Generating final notes…";
    dotColor = "bg-amber-500";
  } else if (event.kind === "thinking") {
    label = "Reviewing recent content";
    dotColor = "bg-amber-500";
  } else if (event.kind === "calling") {
    label = event.label;
    dotColor = "bg-indigo-500";
  }

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span className="relative inline-flex size-2">
        {pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotColor}`}
          />
        )}
        <span
          className={`relative inline-flex size-2 rounded-full ${dotColor}`}
        />
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}
