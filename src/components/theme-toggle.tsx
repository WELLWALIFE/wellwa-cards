"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Mode = "light" | "dark";

function current(): Mode {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.dataset.theme as Mode | undefined;
  if (attr) return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => setMode(current()), []);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("wellwa-theme", next); } catch { /* ignore */ }
    setMode(next);
  }

  return (
    <button
      onClick={toggle}
      className={`grid h-9 w-9 place-items-center rounded-lg border border-border text-muted hover:text-ink hover:bg-surface2 transition-colors ${className}`}
      aria-label={mode === "dark" ? "Switch to light" : "Switch to dark"}
      title={mode === "dark" ? "Day mode" : "Night mode"}
    >
      {mode === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
