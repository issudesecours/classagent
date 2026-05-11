"""Agent orchestrator built around handoffs.

A short triage agent reads each tick's new transcript and hands off to the
right specialist. Each specialist is focused: it owns one card kind and one
tool. This is more reliable than a single agent with many tools because the
routing decision is decoupled from the emission decision — the triage's only
job is "which specialist?", and the specialist's only job is "emit a good
card of my kind, or stay silent if it's a duplicate".

Session memory (SQLiteSession) is shared across triage + specialists for
short-range dedup. A compact title ledger in the prompt covers long-range
dedup over multi-hour lectures.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from typing import Any, Optional

from agents import (
    Agent,
    Runner,
    SessionSettings,
    SQLiteSession,
    function_tool,
    handoff,
)
from loguru import logger

from .broadcaster import Broadcaster

log = logger.bind(tag="orch")


# ─── Card-emitting tools ─────────────────────────────────────────────────────
# Each tool only emits a card via the in-process broadcaster.

_current: Optional["Orchestrator"] = None


async def _emit(card: dict[str, Any]) -> None:
    if _current is None:
        return
    await _current.emit_card(card)


@function_tool
async def show_concept(title: str, summary: str) -> str:
    """Pin a key concept. Title 3–6 words, summary 2–4 lines, student's voice."""
    await _emit({"kind": "concept", "title": title, "body": summary})
    return f"concept pinned: {title}"


@function_tool
async def show_definition(term: str, definition: str) -> str:
    """Pin a formal definition of a term the professor just introduced."""
    await _emit({"kind": "definition", "title": term, "body": definition})
    return f"definition pinned: {term}"


@function_tool
async def show_example(title: str, body: str) -> str:
    """Pin a narrative/conceptual worked example. Not for code or math."""
    await _emit({"kind": "example", "title": title, "body": body})
    return f"example pinned: {title}"


@function_tool
async def show_exercise(question: str, hint: Optional[str] = None) -> str:
    """Pin a short practice question for the student."""
    card: dict[str, Any] = {"kind": "exercise", "title": "Try this", "body": question}
    if hint:
        card["hint"] = hint
    await _emit(card)
    return "exercise pinned"


@function_tool
async def show_code(
    language: str,
    title: str,
    code: str,
    explanation: Optional[str] = None,
) -> str:
    """Pin a syntax-highlighted code snippet (2–10 lines). Include the language."""
    card: dict[str, Any] = {
        "kind": "code",
        "title": title,
        "language": language,
        "body": code,
    }
    if explanation:
        card["explanation"] = explanation
    await _emit(card)
    return f"code pinned: {title}"


@function_tool
async def show_math(
    title: str,
    latex: str,
    explanation: Optional[str] = None,
) -> str:
    """Pin a LaTeX expression (no $ delimiters). E.g. \\int_0^1 x\\,dx."""
    card: dict[str, Any] = {"kind": "math", "title": title, "body": latex}
    if explanation:
        card["explanation"] = explanation
    await _emit(card)
    return f"math pinned: {title}"


@function_tool
async def show_diagram(
    title: str,
    mermaid: str,
    explanation: Optional[str] = None,
) -> str:
    """Pin a Mermaid diagram. Pass raw Mermaid only (no markdown ``` fences). Use real newlines.
    Types: flowchart TD/LR, graph TD/LR, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, mindmap.
    Mermaid cannot draw Euclidean geometry (no true triangle-with-angles); use 3-node flowcharts only for structural cycles. Keep ≤10 nodes."""
    card: dict[str, Any] = {"kind": "diagram", "title": title, "body": mermaid}
    if explanation:
        card["explanation"] = explanation
    await _emit(card)
    return f"diagram pinned: {title}"


@function_tool
async def show_note(category: str, title: str, body: str) -> str:
    """Record minor content. Category: intro | announcement | transition | tangent | summary."""
    await _emit({"kind": "note", "category": category, "title": title, "body": body})
    return f"note recorded: {title}"


# ─── Specialist + triage agents ──────────────────────────────────────────────


def _model() -> str:
    return os.environ.get("ORCHESTRATOR_MODEL", "gpt-4.1")


SPECIALIST_TAIL = (
    "Triage routed this content to you because it fits your specialty. "
    "You are expected to emit a card. Make a clean, useful card even if the "
    "professor's description was informal — pick the canonical form a student "
    "would want to see. "
    "The ONLY reason to abstain is if you'd be emitting a near-exact duplicate "
    "of a card already in the conversation history. Match the language of the "
    "transcript."
)


def _build_specialists() -> dict[str, Agent]:
    code = Agent(
        name="code_specialist",
        handoff_description="Programming content: a function, method, class, syntax pattern, import, library, CLI, code construct.",
        instructions=(
            "You make a code snippet card to illustrate what the professor just discussed. "
            "Call show_code exactly once with a concise (2–10 line) snippet in the relevant language. "
            + SPECIALIST_TAIL
        ),
        model=_model(),
        tools=[show_code],
    )

    math = Agent(
        name="math_specialist",
        handoff_description="Math content: an equation, formula, identity, integral, derivative, summation, matrix, theorem.",
        instructions=(
            "You render a math card. Call show_math exactly once with the LaTeX body (no $ delimiters). "
            "Prefer a clean canonical form over a verbose one. "
            "For geometric figures (triangle, angles, polygon, congruence), use LaTeX "
            "(e.g. \\triangle ABC, \\angle A, similarity) — do not try Mermaid for that. "
            + SPECIALIST_TAIL
        ),
        model=_model(),
        tools=[show_math],
    )

    diagram = Agent(
        name="diagram_specialist",
        handoff_description=(
            "Visual schema. Use when the professor describes a PROCESS or PIPELINE (flowchart/graph), a "
            "CALL FLOW or message exchange (sequenceDiagram), INHERITANCE / class relationships "
            "(classDiagram), STATE TRANSITIONS or lifecycle (stateDiagram-v2), ENTITY relationships "
            "(erDiagram), or a TAXONOMY (mindmap). Choose this whenever you'd reach for a whiteboard. "
            "NOT for Euclidean geometry (triangle as a shape with angles, ruler-and-compass) — that is math/LaTeX."
        ),
        instructions=(
            "You draw a Mermaid diagram explaining what the professor just described. "
            "Call show_diagram exactly once. Pick the right Mermaid type for the content "
            "(flowchart TD/LR or graph TD/LR for flows, sequenceDiagram for interactions, classDiagram for hierarchies, "
            "stateDiagram-v2 for lifecycles, erDiagram for data models, mindmap for taxonomies). "
            "Keep it small (≤10 nodes), use real newlines between statements. "
            "Pass the mermaid argument as RAW syntax only — never wrap it in markdown ``` fences. "
            "Mermaid cannot render a geometric triangle with angles; if the topic is literally a triangle figure, "
            "use instead a 3-node cycle only when it represents relationships (A-->B-->C-->A) with short labels; "
            "otherwise keep the diagram abstract and valid. "
            "Quote node labels that contain parentheses, brackets, or punctuation: A[\"label (note)\"]. "
            + SPECIALIST_TAIL
        ),
        model=_model(),
        tools=[show_diagram],
    )

    concept = Agent(
        name="concept_specialist",
        handoff_description="A major idea being developed or a term being formally defined (not code, not math, not a diagram).",
        instructions=(
            "You pin one card capturing the conceptual takeaway. "
            "Use show_definition when a term is being formally introduced; use show_concept for a "
            "broader idea. Call exactly one tool, then stop. "
            + SPECIALIST_TAIL
        ),
        model=_model(),
        tools=[show_concept, show_definition],
    )

    example = Agent(
        name="example_specialist",
        handoff_description="A worked narrative example or a practice exercise the student could attempt.",
        instructions=(
            "You pin an example or exercise. Use show_example for a worked example, "
            "show_exercise for a short practice question. Call exactly one tool, then stop. "
            + SPECIALIST_TAIL
        ),
        model=_model(),
        tools=[show_example, show_exercise],
    )

    note = Agent(
        name="note_specialist",
        handoff_description="Minor content: intro, announcement, transition between topics, tangent, anecdote, recap.",
        instructions=(
            "You record a small inline note so the lecture record stays complete. "
            "Call show_note exactly once with the right category. Be concise. "
            + SPECIALIST_TAIL
        ),
        model=_model(),
        tools=[show_note],
    )

    return {
        "code": code,
        "math": math,
        "diagram": diagram,
        "concept": concept,
        "example": example,
        "note": note,
    }


def _build_triage(specialists: dict[str, Agent]) -> Agent:
    return Agent(
        name="triage",
        instructions=(
            "You listen to a live university lecture. Each tick you get the new transcript content "
            "since the previous tick.\n\n"
            "Your only job: hand off to ONE specialist that fits the content best — or reply with "
            "the single word 'skip' if nothing in the new content deserves a card.\n\n"
            "Routing cheatsheet:\n"
            "- programming, syntax, a function/library/CLI → code_specialist\n"
            "- equation, formula, derivative, integral, matrix, geometric triangle/angles/polygon → math_specialist\n"
            "- a process, flow, call sequence, hierarchy, state machine, ER, taxonomy (not Euclidean geometry) → diagram_specialist\n"
            "- a major idea or a term being defined → concept_specialist\n"
            "- a worked example or a practice question → example_specialist\n"
            "- intro / announcement / transition / tangent → note_specialist\n\n"
            "If the new content already overlaps something pinned earlier in the conversation, "
            "reply 'skip'. Prefer silence over duplication."
        ),
        model=_model(),
        handoffs=[
            handoff(specialists["code"]),
            handoff(specialists["math"]),
            handoff(specialists["diagram"]),
            handoff(specialists["concept"]),
            handoff(specialists["example"]),
            handoff(specialists["note"]),
        ],
    )


# ─── Stream event labels ─────────────────────────────────────────────────────

_TOOL_LABELS = {
    "show_concept": "Pinning concept",
    "show_definition": "Defining",
    "show_example": "Adding example",
    "show_exercise": "Drafting exercise",
    "show_note": "Noting",
    "show_code": "Writing code",
    "show_math": "Writing equation",
    "show_diagram": "Drawing diagram",
}

_HANDOFF_LABELS = {
    "code_specialist": "Routing to code",
    "math_specialist": "Routing to math",
    "diagram_specialist": "Routing to diagram",
    "concept_specialist": "Routing to concept",
    "example_specialist": "Routing to example",
    "note_specialist": "Routing to note",
}


def _label_for_call(tool_name: str, args: dict[str, Any]) -> str:
    base = _TOOL_LABELS.get(tool_name, tool_name)
    title = args.get("term") or args.get("title") or args.get("category")
    if title:
        return f"{base}: {title}"
    return f"{base}…"


# ─── Orchestrator ────────────────────────────────────────────────────────────


class Orchestrator:
    def __init__(self, broadcaster: Broadcaster) -> None:
        self.broadcaster = broadcaster
        self._specialists = _build_specialists()
        self.agent = _build_triage(self._specialists)

        history_limit = int(os.environ.get("ORCHESTRATOR_HISTORY_LIMIT", "80"))
        self.session = SQLiteSession(
            session_id=f"classagent-{uuid.uuid4().hex[:8]}",
            session_settings=SessionSettings(limit=history_limit),
        )
        log.info(
            f"orchestrator ready: model={_model()} "
            f"specialists={list(self._specialists)} history_limit={history_limit}"
        )

        self._processed_chars = 0
        self._cards: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()
        self._stopped = False

    @property
    def cards(self) -> list[dict[str, Any]]:
        return list(self._cards)

    async def emit_card(self, card: dict[str, Any]) -> None:
        card_with_id = {"id": uuid.uuid4().hex[:8], **card, "at": time.time()}
        self._cards.append(card_with_id)
        await self.broadcaster.publish({"type": "card", "card": card_with_id})

    async def process(self, full_transcript: str) -> None:
        if self._stopped:
            return
        new_text = full_transcript[self._processed_chars:].strip()
        if len(new_text) < 80:
            log.debug(f"tick skipped: only {len(new_text)} new chars (need ≥80)")
            return
        if self._lock.locked():
            log.debug("tick skipped: previous tick still running")
            return

        async with self._lock:
            global _current
            _current = self
            tick_start = time.time()
            tools_called: list[str] = []
            handoffs_seen: list[str] = []
            log.info(
                f"tick start: {len(new_text)} new chars, "
                f"{len(self._cards)} cards pinned so far"
            )
            try:
                await self.broadcaster.publish({
                    "type": "agent_event",
                    "kind": "thinking",
                })
                prompt = self._build_prompt(new_text)
                result = Runner.run_streamed(
                    self.agent,
                    input=prompt,
                    session=self.session,
                )
                async for event in result.stream_events():
                    kind, name = await self._handle_event(event)
                    if kind == "tool" and name:
                        tools_called.append(name)
                    elif kind == "handoff" and name:
                        handoffs_seen.append(name)
            except Exception as e:
                log.exception(f"tick failed: {e}")
                return
            finally:
                _current = None
                try:
                    await self.broadcaster.publish({
                        "type": "agent_event",
                        "kind": "idle",
                    })
                except Exception:
                    pass
            elapsed = time.time() - tick_start
            parts = []
            if handoffs_seen:
                parts.append(f"handoff→{handoffs_seen[-1]}")
            if tools_called:
                parts.append(f"tools={','.join(tools_called)}")
            summary = " ".join(parts) if parts else "skipped (agent chose silence)"
            log.info(f"tick done in {elapsed:.1f}s — {summary}")
            self._processed_chars = len(full_transcript)

    async def _handle_event(self, event: Any) -> tuple[str | None, str | None]:
        """Returns (kind, name) where kind is 'tool' | 'handoff' | None."""
        if getattr(event, "type", "") != "run_item_stream_event":
            return (None, None)
        item = getattr(event, "item", None)
        if item is None:
            return (None, None)
        item_type = getattr(item, "type", "")

        if item_type == "tool_call_item":
            name = _extract_tool_name(item)
            # Handoffs surface as tool_call_item too (transfer_to_*). The
            # SDK also emits a separate handoff_call_item — log/notify there
            # only so we don't duplicate.
            if name.startswith("transfer_to_"):
                return (None, None)
            args = _extract_tool_args(item)
            log.info(f"→ tool {name}({_format_args(args)})")
            await self.broadcaster.publish({
                "type": "agent_event",
                "kind": "calling",
                "tool": name,
                "label": _label_for_call(name, args),
            })
            return ("tool", name)

        if item_type == "handoff_call_item":
            name = _extract_tool_name(item)  # raw_item.name is "transfer_to_..."
            target = _handoff_target(name)
            log.info(f"⇢ handoff to {target}")
            await self.broadcaster.publish({
                "type": "agent_event",
                "kind": "calling",
                "tool": f"handoff:{target}",
                "label": _HANDOFF_LABELS.get(target, f"Routing to {target}"),
            })
            return ("handoff", target)

        return (None, None)

    def _build_prompt(self, new_text: str) -> str:
        # Compact card ledger gives long-range dedup beyond what session memory covers.
        if self._cards:
            ledger_lines = []
            for c in self._cards:
                title = c.get("title", "").strip()
                if c["kind"] == "note":
                    cat = c.get("category", "")
                    ledger_lines.append(f"- note[{cat}]: {title}")
                else:
                    ledger_lines.append(f"- {c['kind']}: {title}")
            ledger = "\n".join(ledger_lines)
        else:
            ledger = "(none yet)"
        return (
            "## Cards already pinned this lecture\n"
            f"{ledger}\n\n"
            "## New transcript content since last tick\n"
            f"{new_text}\n\n"
            "Pick one specialist to hand off to, or reply 'skip'."
        )

    def stop(self) -> None:
        self._stopped = True


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _format_args(args: dict[str, Any], max_len: int = 60) -> str:
    if not args:
        return ""
    parts = []
    for k, v in args.items():
        if isinstance(v, str):
            v_one_line = v.replace("\n", " ⏎ ").strip()
            if len(v_one_line) > max_len:
                v_one_line = v_one_line[: max_len - 1] + "…"
            parts.append(f"{k}={v_one_line!r}")
        else:
            parts.append(f"{k}={v!r}")
    return ", ".join(parts)


def _handoff_target(raw_tool_name: str) -> str:
    # SDK names handoff tools "transfer_to_<agent_name>" by default.
    prefix = "transfer_to_"
    if raw_tool_name.startswith(prefix):
        return raw_tool_name[len(prefix):]
    return raw_tool_name


def _extract_tool_name(item: Any) -> str:
    raw = getattr(item, "raw_item", None)
    if raw is None:
        return ""
    return getattr(raw, "name", "") or ""


def _extract_tool_args(item: Any) -> dict[str, Any]:
    raw = getattr(item, "raw_item", None)
    if raw is None:
        return {}
    arguments = getattr(raw, "arguments", None)
    if isinstance(arguments, str):
        try:
            parsed = json.loads(arguments)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    if isinstance(arguments, dict):
        return arguments
    return {}
