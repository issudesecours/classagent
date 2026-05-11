"use client";

import {
  AcademicCapIcon,
  BookOpenIcon,
  LightBulbIcon,
  PencilSquareIcon,
  CodeBracketIcon,
  VariableIcon,
  Squares2X2Icon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { motion } from "motion/react";
import { Badge } from "@/components/badge";
import { CodeBlock } from "./CodeBlock";
import { MathBlock } from "./MathBlock";
import { DiagramBlock } from "./DiagramBlock";
import type { Card, CardKind } from "./types";

const META: Record<
  Exclude<CardKind, "note">,
  {
    label: string;
    color: Parameters<typeof Badge>[0]["color"];
    Icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }
> = {
  concept: {
    label: "Concept",
    color: "indigo",
    Icon: AcademicCapIcon,
    accent: "from-indigo-500/10",
  },
  definition: {
    label: "Definition",
    color: "blue",
    Icon: BookOpenIcon,
    accent: "from-blue-500/10",
  },
  example: {
    label: "Example",
    color: "emerald",
    Icon: LightBulbIcon,
    accent: "from-emerald-500/10",
  },
  exercise: {
    label: "Exercise",
    color: "amber",
    Icon: PencilSquareIcon,
    accent: "from-amber-500/10",
  },
  code: {
    label: "Code",
    color: "zinc",
    Icon: CodeBracketIcon,
    accent: "from-zinc-500/10",
  },
  math: {
    label: "Math",
    color: "purple",
    Icon: VariableIcon,
    accent: "from-purple-500/10",
  },
  diagram: {
    label: "Diagram",
    color: "cyan",
    Icon: Squares2X2Icon,
    accent: "from-cyan-500/10",
  },
};

const NOTE_BADGE: Record<string, Parameters<typeof Badge>[0]["color"]> = {
  intro: "sky",
  announcement: "amber",
  transition: "zinc",
  tangent: "rose",
  summary: "teal",
};

export function CardItem({ card }: { card: Card }) {
  if (card.kind === "note") return <NoteCard card={card} />;
  return <PrimaryCard card={card} />;
}

function PrimaryCard({ card }: { card: Card }) {
  const meta = META[card.kind as Exclude<CardKind, "note">];
  if (!meta) return null;
  const Icon = meta.Icon;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-xl border border-zinc-950/5 bg-white shadow-xs ring-0 transition hover:shadow-sm dark:border-white/10 dark:bg-zinc-900"
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b ${meta.accent} to-transparent`}
      />
      <div className="relative p-4">
        <div className="mb-2 flex items-center gap-2">
          <Icon className="size-4 text-zinc-500 dark:text-zinc-400" />
          <Badge color={meta.color}>{meta.label}</Badge>
          <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
            {card.title}
          </h3>
        </div>

        {card.kind === "code" ? (
          <>
            <div className="mt-2">
              <CodeBlock code={card.body} language={card.language} />
            </div>
            {card.explanation && (
              <p className="mt-2.5 text-xs/5 text-zinc-600 dark:text-zinc-400">
                {card.explanation}
              </p>
            )}
          </>
        ) : card.kind === "math" ? (
          <>
            <div className="mt-2 overflow-x-auto rounded-lg bg-zinc-50 px-4 py-3 dark:bg-white/5">
              <MathBlock tex={card.body} display />
            </div>
            {card.explanation && (
              <p className="mt-2.5 text-xs/5 text-zinc-600 dark:text-zinc-400">
                {card.explanation}
              </p>
            )}
          </>
        ) : card.kind === "diagram" ? (
          <>
            <div className="mt-2">
              <DiagramBlock source={card.body} />
            </div>
            {card.explanation && (
              <p className="mt-2.5 text-xs/5 text-zinc-600 dark:text-zinc-400">
                {card.explanation}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm/6 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {card.body}
          </p>
        )}

        {card.hint && (
          <p className="mt-3 rounded-md bg-zinc-50 px-2.5 py-1.5 text-xs/5 text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              Hint:{" "}
            </span>
            {card.hint}
          </p>
        )}
      </div>
    </motion.article>
  );
}

function NoteCard({ card }: { card: Card }) {
  const cat = (card.category || "note").toLowerCase();
  const color = NOTE_BADGE[cat] ?? "zinc";
  const label = cat.replace(/^\w/, (c) => c.toUpperCase());

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-lg border border-dashed border-zinc-950/10 bg-white/40 p-3 dark:border-white/10 dark:bg-white/2.5"
    >
      <div className="mb-1 flex items-center gap-2">
        <DocumentTextIcon className="size-3.5 text-zinc-400 dark:text-zinc-500" />
        <Badge color={color}>{label}</Badge>
        <h4 className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {card.title}
        </h4>
      </div>
      <p className="text-xs/5 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
        {card.body}
      </p>
    </motion.article>
  );
}
