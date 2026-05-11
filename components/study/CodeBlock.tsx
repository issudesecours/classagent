"use client";

import { useMemo } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";

interface Props {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: Props) {
  const html = useMemo(() => {
    const lang = (language || "").toLowerCase().trim();
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true })
          .value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return escapeHtml(code);
    }
  }, [code, language]);

  return (
    <div className="classagent-code overflow-hidden rounded-lg border border-zinc-800 bg-[#0d1117] text-[13px] leading-relaxed">
      {language && (
        <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/40 px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400">
            {language}
          </span>
        </div>
      )}
      <pre className="hljs px-3 py-2.5">
        <code
          className={`hljs ${language ? `language-${language}` : ""}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}
