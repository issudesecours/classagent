import asyncio
import json
import os
import time
from datetime import datetime
from pathlib import Path

from loguru import logger

from .broadcaster import Broadcaster
from .orchestrator import Orchestrator
from .transcriber import transcribe_segment

log = logger.bind(tag="session")

ORCHESTRATOR_INTERVAL_S = 20.0


class Session:
    """Owns the pipeline state for one teacher recording session."""

    def __init__(self, broadcaster: Broadcaster) -> None:
        self.broadcaster = broadcaster
        self.orchestrator = Orchestrator(broadcaster)
        self.id = datetime.now().strftime("%Y%m%d-%H%M%S")
        self.started_at = time.time()
        self.transcript_parts: list[dict] = []
        self._tick_task: asyncio.Task | None = None
        self._ingest_tasks: set[asyncio.Task] = set()
        self._stopped = False

    @property
    def full_transcript(self) -> str:
        return " ".join(p["text"] for p in self.transcript_parts if p.get("text"))

    async def start(self) -> None:
        self.broadcaster.reset()
        await self.broadcaster.publish({"type": "status", "state": "live"})
        self._tick_task = asyncio.create_task(self._orchestrator_loop())

    def submit_segment(self, audio_bytes: bytes, mime: str) -> None:
        """Fire-and-forget transcription of one audio segment.

        Tracked so Session.stop() can await any in-flight transcriptions and
        give the agent a chance to process the trailing audio before ending.
        """
        if self._stopped:
            return
        task = asyncio.create_task(self._ingest_segment(audio_bytes, mime))
        self._ingest_tasks.add(task)
        task.add_done_callback(self._ingest_tasks.discard)

    async def _ingest_segment(self, audio_bytes: bytes, mime: str) -> None:
        try:
            text = await transcribe_segment(audio_bytes, mime)
        except Exception as e:
            log.exception(f"transcribe error: {e}")
            return
        if not text:
            return
        at = time.time() - self.started_at
        self.transcript_parts.append({"text": text, "at": at})
        await self.broadcaster.publish({"type": "transcript", "text": text, "at": at})

    async def _orchestrator_loop(self) -> None:
        while not self._stopped:
            await asyncio.sleep(ORCHESTRATOR_INTERVAL_S)
            if self._stopped:
                break
            try:
                await self.orchestrator.process(self.full_transcript)
            except Exception as e:
                log.exception(f"orchestrator-loop error: {e}")

    async def stop(self) -> None:
        """Stop in the right order so the agent finishes processing.

        1. Signal the periodic loop to stop and wait for it to exit cleanly
           (if a tick is in flight it gets cancelled — its partial work is
           lost but the final pass below will reprocess the missed content).
        2. Broadcast 'finalizing' so the student sees a wrap-up indicator.
        3. Await any in-flight whisper transcriptions so the final transcript
           reflects everything the teacher actually said.
        4. Run one final orchestrator pass on the complete transcript. The
           orchestrator is still alive at this point — we only mark it stopped
           afterwards.
        5. Persist, then broadcast 'ended'.
        """
        if self._stopped:
            return
        self._stopped = True
        log.info("stop requested — finalizing")

        if self._tick_task:
            self._tick_task.cancel()
            try:
                await self._tick_task
            except (asyncio.CancelledError, Exception):
                pass

        await self.broadcaster.publish({"type": "status", "state": "finalizing"})

        # Drain pending audio segments (the last few seconds of mic input
        # might still be in transcription when stop is called).
        if self._ingest_tasks:
            pending = list(self._ingest_tasks)
            log.info(f"awaiting {len(pending)} in-flight transcription(s)")
            await asyncio.gather(*pending, return_exceptions=True)

        # Final agent pass on the complete transcript.
        try:
            log.info("running final orchestrator pass")
            await self.orchestrator.process(self.full_transcript)
        except Exception as e:
            log.exception(f"orchestrator-final error: {e}")

        self.orchestrator.stop()
        await self._persist_to_disk()
        await self.broadcaster.publish({"type": "status", "state": "ended"})
        log.info("session ended")

    async def _persist_to_disk(self) -> None:
        data_dir = Path(os.environ.get("DATA_DIR", "./data")) / self.id
        try:
            data_dir.mkdir(parents=True, exist_ok=True)
            (data_dir / "transcript.md").write_text(
                "# Transcript\n\n" + self.full_transcript + "\n",
                encoding="utf-8",
            )
            cards = self.orchestrator.cards
            if cards:
                (data_dir / "cards.json").write_text(
                    json.dumps(cards, indent=2, ensure_ascii=False),
                    encoding="utf-8",
                )
            log.info(
                f"persisted {len(self.transcript_parts)} segments and "
                f"{len(cards)} cards to {data_dir}"
            )
        except Exception as e:
            log.exception(f"persist error: {e}")
