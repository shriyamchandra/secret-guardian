"use client";

import Link from "next/link";
import {
  ShieldCheck,
} from "lucide-react";
// ─── Header ─────────────────────────────────────────────────────────────────

export const Header = () => (
  <header className="sticky top-0 z-30 w-full border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex h-16 items-center justify-between">
        <div className="mr-4 flex-shrink-0">
          <Link href="/" className="flex items-center" aria-label="Secret Guardian">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
            <span className="ml-2 text-xl font-bold tracking-tight text-zinc-100">Secret Guardian</span>
          </Link>
        </div>
        <nav className="hidden md:flex md:flex-grow">
          <ul className="flex flex-grow flex-wrap items-center justify-end gap-1">
            <li>
              <a href="#demo" className="flex items-center px-4 py-2 text-zinc-400 transition-colors hover:text-zinc-100">
                Live Demo
              </a>
            </li>
            <li>
              <a href="#features" className="flex items-center px-4 py-2 text-zinc-400 transition-colors hover:text-zinc-100">
                Features
              </a>
            </li>
            <li>
              <a href="#how-it-works" className="flex items-center px-4 py-2 text-zinc-400 transition-colors hover:text-zinc-100">
                How It Works
              </a>
            </li>
            <li>
              <Link
                href="/scan"
                className="ml-3 inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-emerald-600 px-4 py-2 font-mono text-xs tracking-wide text-white transition-colors hover:bg-emerald-500"
              >
                Start Scanning →
              </Link>
            </li>
          </ul>
        </nav>
        {/* Mobile CTA */}
        <Link
          href="/scan"
          className="md:hidden inline-flex h-9 items-center justify-center rounded-md bg-emerald-600 px-4 font-mono text-xs text-white hover:bg-emerald-500"
        >
          Scan Now
        </Link>
      </div>
    </div>
  </header>
);
