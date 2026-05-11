import asyncio
import json

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .broadcaster import Broadcaster
from .logging_config import configure_logging
from .session import Session

load_dotenv()
configure_logging()
log = logger.bind(tag="api")

app = FastAPI(title="ClassAgent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
