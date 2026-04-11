"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "sg-theme-preference";
const TRANSITION_MS = 280;

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

const getSystemTheme = (): ResolvedTheme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const startThemeTransition = () => {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  window.setTimeout(() => {
    root.classList.remove("theme-transition");
  }, TRANSITION_MS);
};

const applyThemePreference = (preference: ThemePreference, withTransition: boolean) => {
  if (withTransition) {
    startThemeTransition();
  }

  if (preference === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.setAttribute("data-theme", preference);
};

export function ThemeModeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const preferenceRef = useRef<ThemePreference>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initialPreference: ThemePreference = isThemePreference(stored)
      ? stored
      : "system";

    preferenceRef.current = initialPreference;
    setPreference(initialPreference);
    setResolvedTheme(initialPreference === "system" ? getSystemTheme() : initialPreference);
    applyThemePreference(initialPreference, false);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => {
      if (preferenceRef.current === "system") {
        startThemeTransition();
      }

      setResolvedTheme(getSystemTheme());
    };

    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, []);

  useEffect(() => {
    if (preference === "system") {
      setResolvedTheme(getSystemTheme());
    } else {
      setResolvedTheme(preference);
    }
  }, [preference]);

  const activeLabel = useMemo(() => {
    if (preference === "system") {
      return `System (${resolvedTheme})`;
    }

    return preference === "dark" ? "Dark" : "Light";
  }, [preference, resolvedTheme]);

  const updatePreference = (nextPreference: ThemePreference) => {
    preferenceRef.current = nextPreference;
    setPreference(nextPreference);
    applyThemePreference(nextPreference, true);
    window.localStorage.setItem(STORAGE_KEY, nextPreference);
  };

  return (
    <div className="panel-surface-strong fixed right-4 bottom-4 z-[90] flex items-center gap-1 rounded-full p-1 shadow-sm backdrop-blur-sm">
      <span className="px-2 text-[11px] font-medium tracking-wide text-zinc-400 uppercase hidden sm:inline">
        {activeLabel}
      </span>

      <button
        type="button"
        className={`focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${preference === "system" ? "border-zinc-600 bg-zinc-800 text-zinc-100" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-100"}`}
        onClick={() => updatePreference("system")}
        aria-label="Use system theme"
        title="System theme"
      >
        <Laptop className="h-4 w-4" />
      </button>

      <button
        type="button"
        className={`focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${preference === "light" ? "border-zinc-600 bg-zinc-800 text-zinc-100" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-100"}`}
        onClick={() => updatePreference("light")}
        aria-label="Use light theme"
        title="Light theme"
      >
        <Sun className="h-4 w-4" />
      </button>

      <button
        type="button"
        className={`focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${preference === "dark" ? "border-zinc-600 bg-zinc-800 text-zinc-100" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-100"}`}
        onClick={() => updatePreference("dark")}
        aria-label="Use dark theme"
        title="Dark theme"
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}
