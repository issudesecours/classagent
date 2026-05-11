import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .broadcaster import Broadcaster
from .logging_config import configure_logging
from .session import Session

# Uvicorn --reload spawns a worker with a cwd/env that may miss .env unless
# loaded from the backend package root (next to pyproject.toml).
_backend_root = Path(__file__).resolve().parent.parent
load_dotenv(_backend_root / ".env")
configure_logging()
log = logger.bind(tag="api")

if not (os.getenv("OPENAI_API_KEY") or "").strip():
    log.warning(
        "OPENAI_API_KEY is unset or empty — set it in backend/.env; Whisper will fail."
    )

app = FastAPI(title="ClassAgent")

# Comma-separated list, e.g. https://app.vercel.app,http://localhost:3000
# Use * for local dev only.
_origins_raw = (os.environ.get("ALLOW_ORIGINS") or "*").strip()
if _origins_raw == "*":
    _allow_origins: list[str] = ["*"]
else:
    _allow_origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]
    if not _allow_origins:
        _allow_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

broadcaster = Broadcaster()
_session_lock = asyncio.Lock()
_current_session: Session | None = None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/student")
async def ws_student(websocket: WebSocket) -> None:
    await websocket.accept()
    await broadcaster.subscribe(websocket)
    try:
        while True:
            # students don't send; keep the socket open
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await broadcaster.unsubscribe(websocket)


@app.websocket("/ws/teacher")
async def ws_teacher(websocket: WebSocket) -> None:
    """Protocol: client alternates a JSON header then a binary blob.

    Header: {"type": "segment", "mime": "audio/webm", "size": <bytes>}
    Then:   <binary audio bytes>

    Final:  {"type": "stop"} (optional — disconnect also stops)
    """
    await websocket.accept()
    global _current_session

    async with _session_lock:
        if _current_session is not None:
            log.warning("Rejecting teacher: a session is already live")
            await websocket.close(code=4090, reason="A session is already live")
            return
        _current_session = Session(broadcaster)
        await _current_session.start()
        log.info(f"Teacher session started: id={_current_session.id}")

    session = _current_session
    pending_header: dict | None = None

    try:
        while True:
            msg = await websocket.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if "text" in msg and msg["text"] is not None:
                try:
                    header = json.loads(msg["text"])
                except json.JSONDecodeError:
                    continue
                if header.get("type") == "stop":
                    break
                if header.get("type") == "segment":
                    pending_header = header
            elif "bytes" in msg and msg["bytes"] is not None:
                if pending_header is None:
                    continue
                mime = pending_header.get("mime", "audio/webm")
                pending_header = None
                session.submit_segment(msg["bytes"], mime)
    except WebSocketDisconnect:
        pass
    finally:
        async with _session_lock:
            await session.stop()
            log.info(f"Teacher session ended: id={session.id}")
            _current_session = None
