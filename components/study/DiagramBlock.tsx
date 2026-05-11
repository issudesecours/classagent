"use client";

import { useEffect, useId, useRef, useState } from "react";

interface Props {
  source: string;
}

/** LLMs often wrap Mermaid in markdown fences; the renderer needs raw syntax only. */
function normalizeMermaidSource(raw: string): string {
  let s = raw.trim();
  if (!s.startsWith("```")) return s;
  const firstNl = s.indexOf("\n");
  if (firstNl === -1) return s.replace(/^```\w*\s*/, "").replace(/```\s*$/, "").trim();
  s = s.slice(firstNl + 1);
  const end = s.lastIndexOf("```");
  if (end !== -1) s = s.slice(0, end);
  return s.trim();
}

let mermaidInitialized = false;

async function loadMermaid() {
  const mod = await import("mermaid");
  const mermaid = mod.default;
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "strict",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: 13,
    });
    mermaidInitialized = true;
  }
  return mermaid;
}

export function DiagramBlock({ source }: Props) {
  const reactId = useId();
  const renderId = `mmd-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSvg("");
    (async () => {
      try {
        const mermaid = await loadMermaid();
        const cleaned = normalizeMermaidSource(source);
        const { svg } = await mermaid.render(renderId, cleaned);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, renderId]);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800">
      {error ? (
        <div className="space-y-2 text-xs text-red-600 dark:text-red-400">
          <p>Diagram failed to render.</p>
          <pre className="whitespace-pre-wrap rounded bg-red-50 p-2 font-mono text-[11px] text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {source}
          </pre>
        </div>
      ) : svg ? (
        <div
          ref={containerRef}
          className="[&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex h-24 items-center justify-center text-xs text-zinc-400">
          Rendering diagram…
        </div>
      )}
    </div>
  );
}
