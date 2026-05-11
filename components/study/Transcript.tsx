"use client";

import { Fragment, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Text } from "@/components/text";
import type { SessionState, TranscriptSegment } from "./types";

interface Props {
  segments: TranscriptSegment[];
  state: SessionState;
}

export function Transcript({ segments, state }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="pointer-events-none sticky top-0 z-10 h-6 bg-gradient-to-b from-white to-transparent dark:from-zinc-900" />
      <div className="px-6 pt-2 pb-6">
        {segments.length === 0 ? (
          <Text>Listening…</Text>
        ) : (
          <div className="mx-auto max-w-2xl">
            <div className="relative space-y-3 border-l border-zinc-950/5 pl-5 dark:border-white/10">
              {segments.map((seg, i) => {
                const prev = segments[i - 1];
                const showTime =
                  !prev ||
                  Math.floor(seg.at / 60) > Math.floor(prev.at / 60);
                const isLatest = i === segments.length - 1;
                return (
                  <Fragment key={i}>
                    {showTime && <TimeMarker at={seg.at} />}
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className={`relative text-[15px] leading-[1.7] ${
                        isLatest
                          ? "text-zinc-950 dark:text-white"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      <span
                        className={`absolute -left-[27px] top-2 size-1.5 rounded-full ${
                          isLatest
                            ? "bg-indigo-500"
                            : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                      />
                      {seg.text}
                    </motion.p>
                  </Fragment>
                );
              })}
              {state === "live" && <ListeningRow />}
              <div ref={endRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TimeMarker({ at }: { at: number }) {
  return (
    <div className="relative my-4 flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
      <span className="absolute -left-[31px] top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-200 dark:border-zinc-900 dark:bg-zinc-700" />
      <span className="font-mono">{formatElapsed(at)}</span>
      <span className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}

function ListeningRow() {
  return (
    <div className="relative pt-2">
      <span className="absolute -left-[27px] top-3 size-1.5 animate-pulse rounded-full bg-zinc-300 dark:bg-zinc-700" />
      <div className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block size-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-600"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `+${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
