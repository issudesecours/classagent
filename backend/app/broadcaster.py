import asyncio
import json
from typing import Any

from fastapi import WebSocket


class Broadcaster:
    """In-memory pub/sub for student WebSocket clients."""

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self.last_status: str = "idle"
        self.transcript_history: list[dict[str, Any]] = []
        self.cards: list[dict[str, Any]] = []
        self.agent_event: dict[str, Any] = {"kind": "idle"}

    async def subscribe(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.add(ws)
        await ws.send_text(json.dumps({"type": "status", "state": self.last_status}))
        for seg in self.transcript_history:
            await ws.send_text(json.dumps({"type": "transcript", **seg}))
        for card in self.cards:
            await ws.send_text(json.dumps({"type": "card", "card": card}))
        await ws.send_text(json.dumps({"type": "agent_event", **self.agent_event}))

    async def unsubscribe(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def publish(self, payload: dict[str, Any]) -> None:
        kind = payload.get("type")
        if kind == "status":
            self.last_status = payload["state"]
        elif kind == "transcript":
            self.transcript_history.append(
                {"text": payload["text"], "at": payload["at"]}
            )
        elif kind == "card":
            self.cards.append(payload["card"])
        elif kind == "agent_event":
            self.agent_event = {k: v for k, v in payload.items() if k != "type"}

        msg = json.dumps(payload)
        async with self._lock:
            clients = list(self._clients)
        dead: list[WebSocket] = []
        for ws in clients:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._clients.discard(ws)

    def reset(self) -> None:
        self.transcript_history.clear()
        self.cards.clear()
        self.last_status = "idle"
        self.agent_event = {"kind": "idle"}
