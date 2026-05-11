# ClassAgent

> Listens with you. Notes for you.

A live class co-pilot. The teacher records; students see the live transcript on the left and a stream of AI-generated study cards on the right — concepts, definitions, code, math, diagrams, exercises, and notes — pinned in real time by a multi-agent orchestrator.

## Stack

- **Frontend** — Next.js 15 (App Router), Tailwind v4, [Catalyst](https://catalyst.tailwindui.com/) components, [Motion](https://motion.dev/), [KaTeX](https://katex.org/), [highlight.js](https://highlightjs.org/), [Mermaid](https://mermaid.js.org/)
- **Backend** — FastAPI, WebSockets, [uv](https://docs.astral.sh/uv/), [Loguru](https://github.com/Delgan/loguru)
- **Transcription** — OpenAI Whisper (5-second segments, REST)
- **Orchestration** — [openai-agents](https://openai.github.io/openai-agents-python/) with **handoffs**, **sessions**, and tool-driven card emission

## How it works

```
┌──────────┐  audio    ┌──────────┐ text   ┌────────────────────┐
│ Teacher  │ ════════> │ Whisper  │ ═════> │ Triage agent       │
│ (browser)│ WebSocket │ (5s segs)│        │   ↓ handoff        │
└──────────┘           └──────────┘        │ 6 specialists      │
                                            │   ↓ tool call      │
┌──────────┐  cards    ┌──────────┐ events  │ Broadcaster        │
│ Students │ <════════ │ Cards +  │ <══════ │ (per-session       │
│ (browser)│ WebSocket │ activity │         │  SQLiteSession)    │
└──────────┘           └──────────┘         └────────────────────┘
```

### Multi-agent orchestrator

A **triage agent** reads each tick's new transcript content and hands off to one of six specialists, each with a focused job and a single card kind:

| Specialist            | Card kind     | Tool             |
| --------------------- | ------------- | ---------------- |
| `code_specialist`     | code          | `show_code`      |
| `math_specialist`     | math          | `show_math`      |
| `diagram_specialist`  | diagram       | `show_diagram`   |
| `concept_specialist`  | concept / def | `show_concept`, `show_definition` |
| `example_specialist`  | example / ex. | `show_example`, `show_exercise` |
| `note_specialist`     | note          | `show_note`      |

A shared in-memory `SQLiteSession` (capped at the last 80 items by default) gives the agent **short-range memory** — it can see its own prior tool calls and won't re-define `function` thirty seconds after defining it. A compact title-only **ledger** is added to every prompt for **long-range dedup** over 2-hour lectures (~8 tokens per card, scales easily).

### Card kinds rendered in the study panel

- **Concept** — 2–4 line summary of a major idea
- **Definition** — formal definition of a term
- **Example** — narrative worked example
- **Exercise** — short practice question (with optional hint)
- **Code** — syntax-highlighted snippet (highlight.js)
- **Math** — KaTeX-rendered LaTeX
- **Diagram** — Mermaid (flowchart, sequence, class, state, ER, mindmap)
- **Note** — minor content (intros, transitions, tangents) shown inline

Cards are emitted as the lecture progresses, animate in, and can be downloaded at session end as a single `.md` file (mermaid + LaTeX + code fences are preserved — opens cleanly in Notion / Obsidian / GitHub).

## Setup

### Prereqs

- Node 20+
- Python 3.11+
- [`uv`](https://docs.astral.sh/uv/) installed
- OpenAI API key

### Backend

```bash
cd backend
uv sync
cp .env.example .env       # then edit and set OPENAI_API_KEY
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
# from repo root
npm install
npm run dev
```

Open <http://localhost:3000/teach> in one tab and <http://localhost:3000> in another.

## Configuration

Environment variables (in `backend/.env`):

| Var                          | Default        | Purpose |
| ---------------------------- | -------------- | ------- |
| `OPENAI_API_KEY`             | _(required)_   | Whisper + orchestrator |
| `ORCHESTRATOR_MODEL`         | `gpt-4.1`      | Model for triage + specialists |
| `ORCHESTRATOR_HISTORY_LIMIT` | `80`           | How many recent session items the agent sees per tick |
| `DATA_DIR`                   | `./data`       | Where transcripts + cards are persisted on session end |
| `LOG_LEVEL`                  | `INFO`         | `DEBUG` for whisper latency + per-tick details |

The orchestrator tick interval (~20s) lives in `backend/app/session.py` (`ORCHESTRATOR_INTERVAL_S`).

## Protocol

**Teacher** WebSocket (`/ws/teacher`): alternates a JSON header and a binary audio blob.

```
{"type":"segment","mime":"audio/webm","size":12345}    ← text
<binary audio bytes>                                    ← bytes
{"type":"stop"}                                         ← text (optional)
```

**Student** WebSocket (`/ws/student`): receive-only, four message types.

```
{"type":"status","state":"idle"|"live"|"finalizing"|"ended"}
{"type":"transcript","text":"...","at":12.3}
{"type":"card","card":{"id":"...","kind":"concept|definition|example|exercise|code|math|diagram|note", ...}}
{"type":"agent_event","kind":"idle|thinking|calling","tool":"show_diagram","label":"Drawing diagram: …"}
```

`agent_event` drives the live activity strip in the study panel; it isn't persisted.

## Logs

With Loguru wired through, every tick is observable in stderr:

```
10:30:06 INFO    orch         tick start: 307 new chars, 0 cards pinned so far
10:30:07 INFO    orch         ⇢ handoff to diagram_specialist
10:30:10 INFO    orch         → tool show_diagram(title='Function call flow', mermaid='sequenceDi…')
10:30:11 INFO    orch         tick done in 4.8s — handoff→diagram_specialist tools=show_diagram
```

Set `LOG_LEVEL=DEBUG` to also see Whisper latencies per segment and skipped ticks.

## On-end behaviour

When the teacher hits **Stop** (or the WebSocket drops), the session:

1. Cancels the periodic tick loop.
2. Broadcasts `status: finalizing` — students see a "Wrapping up" indicator.
3. Awaits any in-flight Whisper transcriptions (don't lose the final 5 seconds).
4. Runs one final orchestrator pass on the complete transcript.
5. Persists `transcript.md` and `cards.json` under `backend/data/<timestamp>/`.
6. Broadcasts `status: ended` — students get the download banner.

## Limitations / known sharp edges

- One teacher session at a time (no multi-tenant yet).
- Whisper is REST, not streaming — expect ~1–3s lag per 5s segment. Swap to Deepgram or AssemblyAI for sub-second latency.
- No auth. Anyone hitting `/teach` can start a session.
- Mermaid bundle is ~500kb — dynamically imported, so it only loads when a diagram card is rendered.
- The history limit + ledger combo handles 2-hour lectures comfortably, but very long monologues on one topic can still push the agent into duplicates; tune `ORCHESTRATOR_HISTORY_LIMIT` higher if you have the tokens to spare.

## Roadmap

- Persistent multi-tenant sessions (per course, per teacher)
- Course catalog integration (e.g. Swiss schools)
- Streaming transcription (Deepgram / AssemblyAI)
- Additional specialists: external links, exam-prep flagging, citation lookup
- Real Figma export for shareable boards
