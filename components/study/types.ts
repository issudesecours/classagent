export type CardKind =
  | "concept"
  | "definition"
  | "example"
  | "exercise"
  | "code"
  | "math"
  | "diagram"
  | "note";

export interface Card {
  id: string;
  kind: CardKind;
  title: string;
  body: string;
  hint?: string;
  category?: string;
  language?: string;
  explanation?: string;
  at: number;
}

export type AgentEvent =
  | { kind: "idle" }
  | { kind: "thinking" }
  | { kind: "calling"; tool: string; label: string };

export interface TranscriptSegment {
  text: string;
  at: number;
}

export type SessionState = "idle" | "live" | "finalizing" | "ended";

export type StreamMessage =
  | { type: "transcript"; text: string; at: number }
  | { type: "card"; card: Card }
  | ({ type: "agent_event" } & AgentEvent)
  | { type: "status"; state: SessionState };
