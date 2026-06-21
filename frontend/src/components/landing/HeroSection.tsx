"use client";

import Link from "next/link";
import {
  Lock,
  CheckCircle2,
  Eye,
  Shield,
} from "lucide-react";
import { TerminalHero } from "./TerminalHero";
// ─── Hero Section ────────────────────────────────────────────────────────────

export const HeroSection = () => (
  <section className="relative border-b border-zinc-800 pb-16 pt-32 md:pt-40">
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-20 xl:gap-24 items-center">
        {/* Left: copy */}
        <div className="lg:col-span-7">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-emerald-300">
            <Lock className="h-3.5 w-3.5" />
            Read-Only · In-Memory Scanning · 100% Free
          </div>

          <h1 className="mb-5 font-sans text-4xl font-black leading-tight tracking-tight text-zinc-100 md:text-5xl xl:text-6xl">
            Stop Leaking
            <br />
            <span className="text-orange-400">
              API Keys & Secrets
            </span>
          </h1>

          <p className="mb-6 text-lg text-zinc-300 leading-relaxed">
            Scan any public GitHub, GitLab, or Bitbucket repo — or upload a ZIP — and find leaked credentials in seconds.
            Get <span className="text-emerald-300 font-semibold">AI-powered fix instructions</span> for every finding, for free.
          </p>

          {/* Social proof bullets */}
          <ul className="mb-8 space-y-2 text-sm text-zinc-400">
            {[
              "Curated secret signatures: AWS, GitHub, Stripe, Google, SSH keys…",
              "3 scan engines: regex + Gitleaks + TruffleHog",
              "Heuristic noise filter cuts false positives by ~90%",
              "Gemini AI writes framework-specific fix code for every finding",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              <Shield className="h-5 w-5" />
              Scan a Repository Free
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/50 px-6 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            >
              <Eye className="h-5 w-5" />
              See Real Results
            </a>
          </div>

          <p className="mt-4 text-xs text-zinc-600 font-mono">
            No GitHub auth required · ZIP upload for private repos · In-Memory Cache
          </p>
        </div>

        {/* Right: terminal */}
        <div className="lg:col-span-5">
          <TerminalHero />
          <p className="mt-3 text-center text-xs text-zinc-400 font-mono">
            ^ Simulated — real scans stream findings live
          </p>
        </div>
      </div>
    </div>
  </section>
);
