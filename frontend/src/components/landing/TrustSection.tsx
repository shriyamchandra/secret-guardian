"use client";

import {
  Zap,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Database,
  ExternalLink,
} from "lucide-react";
// ─── Trust Section ───────────────────────────────────────────────────────────

const TRUST_ITEMS = [
  {
    icon: Lock,
    title: "Read-Only Scanning",
    desc: "We clone, scan, then delete. We never modify your code or commit anything.",
  },
  {
    icon: Shield,
    title: "Short-Lived Reveal Cache",
    desc: "Repository files are deleted immediately after scanning. Result summaries and reveal tokens are cached in volatile memory for 5 minutes.",
  },
  {
    icon: Zap,
    title: "No Auth Required",
    desc: "Public repos work without any GitHub/GitLab/Bitbucket authentication.",
  },
  {
    icon: Database,
    title: "Malicious Payload Protection",
    desc: "Enterprise-grade protection against zip-bombs, path traversals, and recursion loops.",
  },
  {
    icon: AlertTriangle,
    title: "Fair Use Protection",
    desc: "Smart request limits protect platform resources from abuse and ensure consistent speed for everyone.",
  },
  {
    icon: ExternalLink,
    title: "Open Source Spirit",
    desc: "Built transparently. Architecture blueprints and design decisions documented.",
  },
];

export const TrustSection = () => (
  <section className="relative overflow-hidden z-10 border-b border-zinc-800 bg-zinc-950 py-16">
    {/* Fluid animated background glows */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      {/* Emerald fluid blob on the left */}
      <div className="absolute top-[20%] left-[-10%] w-[360px] h-[360px] bg-emerald-500/15 dark:bg-emerald-500/8 blur-[90px] animate-fluid-blob-1" />
      {/* Amber fluid blob on the right */}
      <div className="absolute bottom-[20%] right-[-10%] w-[330px] h-[330px] bg-amber-500/15 dark:bg-amber-500/8 blur-[80px] animate-fluid-blob-2" />
    </div>

    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-sans font-bold text-zinc-100">Built with Security-First Principles</h2>
          <p className="mt-2 text-zinc-300">Your code is safe. Here&apos;s exactly how.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="text-sm text-emerald-300 font-mono">All {TRUST_ITEMS.length} controls active</span>
        </div>
      </div>

      {/* Horizontal divider list — no cards */}
      <div className="divide-y divide-zinc-800/60 panel-surface overflow-hidden">
        {TRUST_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="group flex items-center gap-5 px-6 py-4 bg-zinc-900/20 backdrop-blur-sm hover:bg-zinc-800/30 transition-colors">
              <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 group-hover:border-emerald-800 transition-colors">
                <Icon className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-zinc-100">{item.title}</span>
                <span className="hidden sm:inline text-zinc-500 mx-3">—</span>
                <span className="block sm:inline text-sm text-zinc-300 mt-0.5 sm:mt-0">{item.desc}</span>
              </div>
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          );
        })}
      </div>
    </div>
  </section>
);
