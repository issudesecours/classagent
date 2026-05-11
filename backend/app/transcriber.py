import io
import os
import time

from loguru import logger
from openai import AsyncOpenAI

log = logger.bind(tag="whisper")

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        _client = AsyncOpenAI(api_key=key)
    return _client


async def transcribe_segment(audio_bytes: bytes, mime: str) -> str:
    """Send a single audio segment to Whisper and return the text."""
    ext = _ext_for_mime(mime)
    f = io.BytesIO(audio_bytes)
    f.name = f"segment.{ext}"

    client = _get_client()
    start = time.time()
    resp = await client.audio.transcriptions.create(
        model="whisper-1",
        file=f,
        response_format="text",
    )
    text = resp if isinstance(resp, str) else getattr(resp, "text", "")
    text = (text or "").strip()
    log.debug(
        f"segment ({len(audio_bytes)} bytes, {mime}) → "
        f"{len(text)} chars in {time.time() - start:.2f}s"
    )
    return text


def _ext_for_mime(mime: str) -> str:
    m = (mime or "").lower()
    if "webm" in m:
        return "webm"
    if "ogg" in m:
        return "ogg"
    if "mp4" in m or "m4a" in m:
        return "mp4"
    if "wav" in m:
        return "wav"
    return "webm"
