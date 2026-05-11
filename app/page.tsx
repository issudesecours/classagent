"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { WS_BASE } from "@/lib/api";
import { Heading, Subheading } from "@/components/heading";
import { Text } from "@/components/text";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import {
  buildNotesMarkdown,
  buildTranscriptMarkdown,
  downloadFile,
  sessionFilename,
} from "@/lib/download";
import { AgentStrip } from "@/components/study/AgentStrip";
import { CardItem } from "@/components/study/Cards";
import { Transcript } from "@/components/study/Transcript";
import type {
  AgentEvent,
  Card,
  SessionState,
  StreamMessage,
  TranscriptSegment,
} from "@/components/study/types";

export default function StudentPage() {
  const [state, setState] = useState<SessionState>("idle");
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [agentEvent, setAgentEvent] = useState<AgentEvent>({ kind: "idle" });
  const [sessionDate, setSessionDate] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const cardsEndRef = useRef<HTMLDivElement | null>(null);

  const downloadNotes = useMemo(
    () => () => {
      const d = sessionDate ?? new Date();
      downloadFile(
        sessionFilename("lecture-notes", d),
        buildNotesMarkdown(cards, d)
      );
    },
    [cards, sessionDate]
  );

  const downloadTranscript = useMemo(
    () => () => {
      const d = sessionDate ?? new Date();
      downloadFile(
        sessionFilename("lecture-transcript", d),
        buildTranscriptMarkdown(transcript, d)
      );
    },
    [transcript, sessionDate]
  );

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/student`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as StreamMessage;
        if (msg.type === "transcript") {
          setTranscript((prev) => [...prev, { text: msg.text, at: msg.at }]);
        } else if (msg.type === "card") {
          setCards((prev) => [...prev, msg.card]);
        } else if (msg.type === "agent_event") {
          const { type: _t, ...rest } = msg;
          setAgentEvent(rest as AgentEvent);
        } else if (msg.type === "status") {
          if (msg.state === "live") {
            setTranscript([]);
            setCards([]);
            setAgentEvent({ kind: "idle" });
            setSessionDate(new Date());
          }
          setState(msg.state);
        }
      } catch {
        // ignore malformed
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    cardsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cards]);

  return (
    <div className="flex h-svh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-950/5 bg-white px-6 py-4 dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <Heading level={1} className="!text-lg">
            ClassAgent
          </Heading>
          <StatusBadge state={state} />
        </div>
        <Button href="/teach" plain>
          Teacher view
        </Button>
      </header>

      {state === "idle" && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Subheading className="!text-base">
              Waiting for the class to start…
            </Subheading>
            <Text className="mt-2">
              The transcript will appear here as soon as the teacher begins.
            </Text>
          </div>
        </div>
      )}

      {state === "ended" && (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-950/5 bg-zinc-50 px-6 py-3 dark:border-white/10 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Badge color="zinc">Session ended</Badge>
            <Text className="!text-xs">
              Save your record before closing the tab.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={downloadNotes} color="indigo">
              <ArrowDownTrayIcon data-slot="icon" />
              Download notes
            </Button>
            <Button onClick={downloadTranscript} outline>
              <ArrowDownTrayIcon data-slot="icon" />
              Download transcript
            </Button>
          </div>
        </div>
      )}

      {state !== "idle" && (
        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
          <section className="flex min-h-0 flex-col border-b border-zinc-950/5 bg-white lg:border-r lg:border-b-0 dark:border-white/10 dark:bg-zinc-900">
            <div className="border-b border-zinc-950/5 px-6 py-3 dark:border-white/10">
              <Subheading className="!text-sm">Live transcript</Subheading>
            </div>
            <Transcript segments={transcript} state={state} />
          </section>

          <section className="flex min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
            <div className="flex flex-col gap-2 border-b border-zinc-950/5 bg-white px-6 py-3 dark:border-white/10 dark:bg-zinc-900">
              <Subheading className="!text-sm">Study panel</Subheading>
              <AgentStrip event={agentEvent} sessionState={state} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {cards.length === 0 ? (
                <Text>
                  Your study assistant will fill this panel as the lecture
                  progresses.
                </Text>
              ) : (
                <div className="mx-auto max-w-2xl space-y-3">
                  <AnimatePresence initial={false}>
                    {cards.map((c) => (
                      <CardItem key={c.id} card={c} />
                    ))}
                  </AnimatePresence>
                  <div ref={cardsEndRef} />
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ state }: { state: SessionState }) {
  if (state === "live") return <Badge color="red">Live</Badge>;
  if (state === "finalizing") return <Badge color="amber">Wrapping up</Badge>;
  if (state === "ended") return <Badge color="zinc">Ended</Badge>;
  return <Badge color="zinc">Waiting</Badge>;
}
