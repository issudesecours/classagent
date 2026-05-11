"use client";

import { useEffect, useRef, useState } from "react";
import { WS_BASE } from "@/lib/api";
import { Button } from "@/components/button";
import { Heading, Subheading } from "@/components/heading";
import { Text } from "@/components/text";
import { Badge } from "@/components/badge";

const SEGMENT_MS = 5000;

export default function TeachPage() {
  const [state, setState] = useState<"idle" | "live" | "ending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppingRef = useRef(false);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ws = new WebSocket(`${WS_BASE}/ws/teacher`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("Failed to connect to backend"));
      });

      setupLevelMeter(stream);
      startSegment();

      startTimeRef.current = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      setState("live");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      cleanup();
    }
  }

  function startSegment() {
    const stream = streamRef.current;
    if (!stream) return;

    const mime = pickSupportedMime();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorderRef.current = recorder;

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      if (chunks.length === 0) return;
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const buf = await blob.arrayBuffer();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "segment", mime: recorder.mimeType, size: buf.byteLength })
        );
        ws.send(buf);
      }
    };

    recorder.start();
    segmentTimerRef.current = setTimeout(() => {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
      if (!stoppingRef.current && streamRef.current) startSegment();
    }, SEGMENT_MS);
  }

  function setupLevelMeter(stream: MediaStream) {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(1, rms * 4));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }

  async function stop() {
    setState("ending");
    stoppingRef.current = true;

    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        const prevOnStop = recorder.onstop;
        recorder.onstop = async (ev) => {
          if (typeof prevOnStop === "function") {
            await Promise.resolve(prevOnStop.call(recorder, ev));
          }
          resolve();
        };
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      });
    }

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stop" }));
    }

    cleanup();
    stoppingRef.current = false;
    setState("idle");
    setElapsed(0);
    setLevel(0);
  }

  function cleanup() {
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    wsRef.current = null;
  }

  useEffect(() => () => cleanup(), []);

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heading level={1} className="!text-lg">
            ClassAgent — Teacher
          </Heading>
          {state === "live" && <Badge color="red">Recording</Badge>}
        </div>
        <Button href="/" plain>
          Student view
        </Button>
      </header>

      <div className="mt-16 flex flex-1 flex-col items-center justify-start">
        <Subheading className="!text-base">Start your lecture</Subheading>
        <Text className="mt-2 max-w-md text-center">
          Click start to broadcast your voice live to subscribed students.
        </Text>

        <div className="mt-10 flex flex-col items-center gap-6">
          <LevelRing level={level} live={state === "live"} />
          <div className="text-3xl tabular-nums text-zinc-700 dark:text-zinc-300">
            {fmtClock(elapsed)}
          </div>

          {state === "idle" && (
            <Button color="red" onClick={start}>
              Start recording
            </Button>
          )}
          {state === "live" && (
            <Button color="zinc" onClick={stop}>
              Stop recording
            </Button>
          )}
          {error && (
            <Text className="!text-red-600 dark:!text-red-400">{error}</Text>
          )}
        </div>
      </div>
    </div>
  );
}

function LevelRing({ level, live }: { level: number; live: boolean }) {
  const size = 160;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const scale = 0.6 + level * 0.6;
  return (
    <div
      className="relative grid place-items-center rounded-full"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={live ? "rgb(220 38 38)" : "rgb(113 113 122)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - c * (0.1 + level * 0.9)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 80ms linear" }}
        />
      </svg>
      <div
        className={`size-16 rounded-full ${
          live ? "bg-red-500" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
        style={{
          transform: `scale(${live ? scale : 1})`,
          transition: "transform 80ms ease-out",
        }}
      />
    </div>
  );
}

function fmtClock(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function pickSupportedMime(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}
