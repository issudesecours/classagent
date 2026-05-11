"use client";

import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface Props {
  tex: string;
  display?: boolean;
}

export function MathBlock({ tex, display = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(tex, ref.current, {
        displayMode: display,
        throwOnError: false,
        output: "html",
      });
    } catch {
      if (ref.current) ref.current.textContent = tex;
    }
  }, [tex, display]);

  return <div ref={ref} className="text-zinc-900 dark:text-zinc-100" />;
}
