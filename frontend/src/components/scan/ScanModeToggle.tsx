"use client";

import { Github, Upload } from "lucide-react";

interface ScanModeToggleProps {
  scanMode: "url" | "upload";
  onSwitch: (mode: "url" | "upload") => void;
}

/** URL-vs-ZIP scan mode switch. */
export function ScanModeToggle({ scanMode, onSwitch }: ScanModeToggleProps) {
  return (
    <div className="mb-4 flex max-w-sm rounded-md border border-zinc-800 bg-zinc-900 p-1">
      <button
        onClick={() => onSwitch("url")}
        className={`focus-ring flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${scanMode === "url" ? "border border-zinc-700 bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"}`}
        aria-label="Switch to repository URL scan"
      >
        <Github className="h-4 w-4" />
        <span>Repository URL</span>
      </button>
      <button
        onClick={() => onSwitch("upload")}
        className={`focus-ring flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${scanMode === "upload" ? "border border-zinc-700 bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"}`}
        aria-label="Switch to ZIP upload scan"
      >
        <Upload className="h-4 w-4" />
        <span>Upload ZIP</span>
      </button>
    </div>
  );
}
