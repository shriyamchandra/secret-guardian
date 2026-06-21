"use client";

import {
  ShieldCheck,
  Github,
} from "lucide-react";
// ─── Footer ──────────────────────────────────────────────────────────────────

export const Footer = () => (
  <footer className="bg-zinc-950 py-10 text-zinc-400">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <span className="text-lg font-bold text-zinc-100">Secret Guardian</span>
        </div>
        <div className="text-sm font-mono text-zinc-500">
          © 2025 Secret Guardian · Read-only scanning · In-Memory Cache · MIT License
        </div>
        <div className="flex gap-4">
          <a href="https://github.com" className="transition-colors hover:text-zinc-100">
            <Github className="h-5 w-5" />
          </a>
        </div>
      </div>
    </div>
  </footer>
);
