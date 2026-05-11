export interface DownloadCard {
  kind:
    | "concept"
    | "definition"
    | "example"
    | "exercise"
    | "code"
    | "math"
    | "diagram"
    | "note";
  title: string;
  body: string;
  hint?: string;
  category?: string;
  language?: string;
  explanation?: string;
  at: number;
}

export interface TranscriptSegment {
  text: string;
  at: number;
}

const LABEL: Record<DownloadCard["kind"], string> = {
  concept: "Concept",
  definition: "Definition",
  example: "Example",
  exercise: "Exercise",
  code: "Code",
  math: "Math",
  diagram: "Diagram",
  note: "Note",
};

export function buildNotesMarkdown(
  cards: DownloadCard[],
  date: Date = new Date()
): string {
  const dateStr = formatDate(date);
  let md = `# Lecture notes\n_${dateStr}_\n\n---\n\n`;
  if (cards.length === 0) {
    md += "_No content was captured._\n";
    return md;
  }
  for (const c of cards) {
    if (c.kind === "note") {
      const cat = (c.category || "Note").replace(/^\w/, (s) => s.toUpperCase());
      md += `> **${cat}${c.title ? ` — ${c.title}` : ""}**\n>\n`;
      const body = c.body
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
      md += `${body}\n\n`;
    } else if (c.kind === "code") {
      md += `## ${LABEL.code} — ${c.title}\n\n`;
      md += "```" + (c.language || "") + "\n";
      md += c.body.trim() + "\n";
      md += "```\n\n";
      if (c.explanation) md += `${c.explanation}\n\n`;
    } else if (c.kind === "math") {
      md += `## ${LABEL.math} — ${c.title}\n\n`;
      md += "$$\n" + c.body.trim() + "\n$$\n\n";
      if (c.explanation) md += `${c.explanation}\n\n`;
    } else if (c.kind === "diagram") {
      md += `## ${LABEL.diagram} — ${c.title}\n\n`;
      md += "```mermaid\n" + c.body.trim() + "\n```\n\n";
      if (c.explanation) md += `${c.explanation}\n\n`;
    } else {
      md += `## ${LABEL[c.kind]} — ${c.title}\n\n`;
      md += `${c.body.trim()}\n\n`;
      if (c.hint) {
        md += `**Hint:** ${c.hint}\n\n`;
      }
    }
  }
  return md.trim() + "\n";
}

export function buildTranscriptMarkdown(
  transcript: TranscriptSegment[],
  date: Date = new Date()
): string {
  const dateStr = formatDate(date);
  let md = `# Lecture transcript\n_${dateStr}_\n\n`;
  for (const seg of transcript) {
    md += `${seg.text}\n\n`;
  }
  return md.trim() + "\n";
}

export function downloadFile(
  filename: string,
  content: string,
  mime = "text/markdown;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function sessionFilename(prefix: string, date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${prefix}-${stamp}.md`;
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}
