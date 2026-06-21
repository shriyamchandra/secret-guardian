"use client";

import { useState, useEffect } from "react";
import {
  Terminal,
} from "lucide-react";
// ─── Terminal animation lines ───────────────────────────────────────────────

const TERMINAL_LINES = [
  { delay: 0,    color: "text-zinc-400",   text: "$ secret-guardian scan https://github.com/acme/backend" },
  { delay: 600,  color: "text-emerald-400", text: "✓ Cloning repository... done (312 files)" },
  { delay: 1200, color: "text-emerald-400", text: "✓ Running regex engine (curated signatures)..." },
  { delay: 1800, color: "text-orange-300",  text: "✓ Running Gitleaks + TruffleHog scanners..." },
  { delay: 2400, color: "text-orange-300",  text: "✓ Applying heuristic noise filter..." },
  { delay: 3000, color: "text-red-400",     text: "[CRITICAL] AWS Access Key ID   src/config/aws.js:15" },
  { delay: 3400, color: "text-orange-400",  text: "[HIGH]     GitHub Token         .env:3" },
  { delay: 3800, color: "text-yellow-400",  text: "[MEDIUM]   Generic API Key      src/services/maps.js:42" },
  { delay: 4300, color: "text-emerald-400", text: "✓ Requesting AI remediation (Gemini)..." },
  { delay: 4900, color: "text-emerald-300", text: "✓ Scan complete — 3 secrets found in 3 files (~30s avg)" },
  { delay: 5300, color: "text-zinc-500",    text: "  Short-lived memory cache. Temp files cleaned from server." },
];

export function TerminalHero() {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    TERMINAL_LINES.forEach((line, i) => {
      timers.push(setTimeout(() => setVisibleLines((prev) => [...prev, i]), line.delay));
    });
    // Cursor blink
    const cursorInterval = setInterval(() => setShowCursor((p) => !p), 530);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(cursorInterval);
    };
  }, []);

  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/60 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-zinc-700/50 bg-zinc-800/40 backdrop-blur-md px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-red-500/70" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
        <div className="ml-3 flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-mono text-xs text-zinc-400">secret-guardian</span>
        </div>
      </div>
      {/* Terminal body */}
      <div className="p-5 font-mono text-sm space-y-1.5 min-h-[280px]">
        {TERMINAL_LINES.map((line, i) => (
          <div
            key={i}
            className={`transition-all duration-300 ${
              visibleLines.includes(i) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            } ${line.color}`}
          >
            {line.text}
          </div>
        ))}
        {visibleLines.length > 0 && (
          <span
            className={`inline-block h-4 w-2 bg-emerald-400 ${
              showCursor ? "opacity-100" : "opacity-0"
            } transition-opacity duration-100`}
          />
        )}
      </div>
    </div>
  );
}
