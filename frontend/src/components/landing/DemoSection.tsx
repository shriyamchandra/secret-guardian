"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ShieldCheck,
  FileJson,
  Shield,
  Terminal,
  Copy,
  ArrowRight,
} from "lucide-react";
import { MockFindingCard, MOCK_FINDINGS } from "./MockFindingCard";
// ─── Demo Results Section ────────────────────────────────────────────────────

export function DemoSection() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <section id="demo" className="relative overflow-hidden z-10 border-b border-zinc-800 bg-zinc-950 py-20">
      {/* Fluid animated background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* Rose/red fluid blob on the left */}
        <div className="absolute top-[10%] left-[-10%] w-[400px] h-[400px] bg-red-500/15 dark:bg-red-500/8 blur-[100px] animate-fluid-blob-1" />
        {/* Emerald fluid blob on the right */}
        <div className="absolute bottom-[10%] right-[-5%] w-[420px] h-[420px] bg-emerald-500/20 dark:bg-emerald-500/10 blur-[90px] animate-fluid-blob-3" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-orange-800 bg-orange-950/30 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-orange-300">
            <Terminal className="h-3.5 w-3.5" />
            Live Output Preview
          </div>
          <h2 className="text-3xl font-sans font-bold text-zinc-100">This Is What You Actually Get</h2>
          <p className="mt-3 max-w-xl mx-auto text-zinc-400">
            {/* Real scan output — severity-rated findings, masked secrets, entropy scores, scanner sources, and AI-written fix guides — all in one view. */}
            Real scan output — severity-rated findings, raw secrets, entropy scores, scanner sources, and AI-written fix guides — all in one view.
          </p>
        </div>

        {/* Scan summary bar */}
        <div className="mb-6 panel-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-800 bg-emerald-950/40">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="font-semibold text-zinc-100 font-mono text-sm">github.com/acme/backend</div>
                <div className="text-xs text-zinc-500">312 files · scan duration ~30s avg · 38 false positives filtered</div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-red-400">1</div>
                <div className="text-[11px] text-zinc-500 uppercase tracking-wide">Critical</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-orange-400">1</div>
                <div className="text-[11px] text-zinc-500 uppercase tracking-wide">High</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-yellow-400">1</div>
                <div className="text-[11px] text-zinc-500 uppercase tracking-wide">Medium</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-emerald-400">~30s</div>
                <div className="text-[11px] text-zinc-500 uppercase tracking-wide">Avg Time</div>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
                  <FileJson className="h-3.5 w-3.5" /> Export JSON
                </button>
                <button className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
                  <Copy className="h-3.5 w-3.5" /> Copy Summary
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Finding cards */}
        <div className="space-y-4">
          {MOCK_FINDINGS.map((finding, i) => (
            <MockFindingCard
              key={i}
              finding={finding}
              isExpanded={expandedIndex === i}
              onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
            />
          ))}
        </div>

        {/* CTA below */}
        <div className="mt-10 text-center">
          <Link
            href="/scan"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <Shield className="h-5 w-5" />
            Scan Your Repository Now
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-xs text-zinc-600">No account. No auth. In-Memory Cache. Completely free.</p>
        </div>
      </div>
    </section>
  );
}
