"use client";

import Link from "next/link";
import { Lock, Shield, ShieldCheck } from "lucide-react";

/** Static branding bar for the scan page. */
export function ScanPageHeader() {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 py-3 sm:py-4">
      <Link
        href="/"
        className="flex items-center gap-3 sm:gap-4 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-md border border-emerald-800 bg-emerald-950/40">
          <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-300" />
        </div>
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-zinc-100">
            Secret Guardian
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Real-Time Security Tool
          </p>
        </div>
      </Link>

      <div className="hidden lg:flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
          <span className="text-[11px] font-mono uppercase text-emerald-300">
            Read-Only
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-800 bg-emerald-950/30 px-3 py-1.5">
          <Lock className="h-3.5 w-3.5 text-emerald-300" />
          <span className="text-[11px] font-mono uppercase text-emerald-300">
            In-Memory Cache
          </span>
        </div>
      </div>
    </div>
  );
}
