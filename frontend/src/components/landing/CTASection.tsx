"use client";

import Link from "next/link";
import {
  Shield,
  ArrowRight,
} from "lucide-react";
// ─── CTA Section ─────────────────────────────────────────────────────────────

export const CTASection = () => (
  <section className="relative border-b border-zinc-800 bg-zinc-950 py-24 overflow-hidden">
    {/* Fluid animated background glows */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      <div className="absolute top-[20%] left-[10%] w-[280px] h-[280px] bg-emerald-500/20 dark:bg-emerald-500/10 blur-[60px] animate-fluid-blob-1" />
      <div className="absolute bottom-[10%] right-[10%] w-[240px] h-[240px] bg-amber-500/15 dark:bg-amber-400/10 blur-[50px] animate-fluid-blob-2" />
    </div>
    <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950/30 px-4 py-1.5 font-mono text-xs text-emerald-300">
        <Shield className="h-3.5 w-3.5" />
        Free · No signup · Takes 30 seconds
      </div>
      <h2 className="mb-4 text-4xl font-sans font-extrabold text-zinc-100">
        Is Your Code Leaking Secrets Right Now?
      </h2>
      <p className="mb-8 text-xl text-zinc-400">
        Paste a GitHub repo URL and find out in under a minute.
      </p>
      <Link
        href="/scan"
        className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-10 py-4 text-lg font-bold text-white transition-colors hover:bg-emerald-500"
      >
        <Shield className="h-6 w-6" />
        Scan for Free
        <ArrowRight className="h-5 w-5" />
      </Link>
      <p className="mt-4 text-sm text-zinc-600 font-mono">
        No account · In-Memory Cache · Read-only · Works on public repos
      </p>
    </div>
  </section>
);
