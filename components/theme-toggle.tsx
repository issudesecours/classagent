"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/20/solid";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="size-8" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {theme === "dark" ? (
        <SunIcon className="size-5" />
      ) : (
        <MoonIcon className="size-5" />
      )}
    </button>
  );
}
