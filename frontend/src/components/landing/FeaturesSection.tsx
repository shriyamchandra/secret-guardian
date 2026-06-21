"use client";

import {
  Bot,
  Lock,
  AlertTriangle,
  Key,
  EyeOff,
} from "lucide-react";
// ─── Features Section ────────────────────────────────────────────────────────


export const FeaturesSection = () => (
  <section id="features" className="relative overflow-hidden z-10 border-b border-zinc-800 bg-zinc-950 py-24">
    {/* Fluid animated background glows */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      {/* Amber/yellow fluid blob on the left */}
      <div className="absolute top-[20%] left-[-5%] w-[350px] h-[350px] bg-amber-500/15 dark:bg-amber-500/8 blur-[100px] animate-fluid-blob-1" />
      {/* Emerald/green fluid blob on the right */}
      <div className="absolute bottom-[20%] right-[-5%] w-[380px] h-[380px] bg-emerald-500/20 dark:bg-emerald-500/10 blur-[90px] animate-fluid-blob-2" />
    </div>

    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-sans font-bold text-zinc-100 md:text-4xl">Everything You Need to Find &amp; Fix Leaks</h2>
        <p className="mt-4 text-zinc-400 text-lg max-w-2xl mx-auto">
          Engineered for signal, not noise. The complete toolkit for modern secret security.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Card 1: Curated Secret Signatures (col-span-2) ── */}
        <div className="lg:col-span-2 group relative overflow-hidden panel-surface !rounded-3xl p-8 transition-all hover:bg-zinc-900/40 hover:border-zinc-700/60">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col md:flex-row gap-10">
            <div className="md:w-[45%] flex flex-col justify-center">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/30 text-red-400 shadow-[0_0_15px_rgba(248,113,113,0.1)]">
                <Key className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-100 mb-3">Curated Secret Signatures</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Detects AWS keys, GitHub tokens, API keys, database credentials, private keys, and more.
              </p>
              <div className="flex flex-wrap gap-2">
                {["AWS AKIA*","GitHub ghp_*","Stripe sk_live_*"].map(ex=>(
                  <span key={ex} className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 backdrop-blur-sm px-3 py-1.5 font-mono text-xs text-zinc-400">{ex}</span>
                ))}
              </div>
            </div>
            <div className="flex-1 rounded-xl border border-zinc-800/50 bg-zinc-950/30 backdrop-blur-sm overflow-hidden font-mono text-xs shadow-2xl">
              <div className="flex items-center gap-2 border-b border-zinc-800/50 px-4 py-3 bg-zinc-900/30 backdrop-blur-sm">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="ml-2 text-zinc-500 font-medium">scan_results.log</span>
              </div>
              <div className="p-5 space-y-3 bg-zinc-950/20">
                {[
                  // DEBUG: masked preview values commented out while raw debug is enabled.
                  // {type:"AWS Access Key ID",val:"AKIA••••WXYZ",sev:"CRITICAL",c:"text-red-400",bg:"bg-red-400/10"},
                  // {type:"GitHub PAT",val:"ghp_••••R7mX",sev:"HIGH",c:"text-orange-400",bg:"bg-orange-400/10"},
                  // {type:"Stripe Secret Key",val:"sk_live_••••",sev:"CRITICAL",c:"text-red-400",bg:"bg-red-400/10"},
                  // {type:"MongoDB URI",val:"mongodb+srv://…",sev:"HIGH",c:"text-orange-400",bg:"bg-orange-400/10"},
                  {type:"AWS Access Key ID",val:"AKIAIOSFODNN7EXAMPLE",sev:"CRITICAL",c:"text-red-400",bg:"bg-red-400/10"},
                  {type:"GitHub PAT",val:"ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",sev:"HIGH",c:"text-orange-400",bg:"bg-orange-400/10"},
                  {type:"Stripe Secret Key",val:"stripe_secret_xxxxxxxxxxxxxxxxxxxx",sev:"CRITICAL",c:"text-red-400",bg:"bg-red-400/10"},
                  {type:"MongoDB URI",val:"mongodb+srv://user:password@example.test/app",sev:"HIGH",c:"text-orange-400",bg:"bg-orange-400/10"},
                ].map(r=>(
                  <div key={r.type} className="flex items-center justify-between gap-4">
                    <span className="text-zinc-400 truncate flex-1">{r.type}</span>
                    <span className="text-zinc-500">{r.val}</span>
                    <span className={`${r.c} ${r.bg} px-2 py-0.5 rounded font-bold tracking-wider text-[9px]`}>{r.sev}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2: Severity (col-span-1) ── */}
        <div className="lg:col-span-1 group relative overflow-hidden panel-surface !rounded-3xl p-8 transition-all hover:bg-zinc-900/40 hover:border-zinc-700/60 flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex-1">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-800/50 bg-yellow-950/30 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.1)]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-3">Threat Context</h3>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Critical / High / Medium / Low ratings — plus exploitability status.
            </p>
          </div>
          <div className="relative z-10 mt-auto">
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/30 backdrop-blur-sm p-4 space-y-3 font-mono text-[11px] shadow-xl">
              {[
                {sev:"CRITICAL",barC:"bg-red-500",w:"88%"},
                {sev:"HIGH",barC:"bg-orange-500",w:"58%"},
                {sev:"MEDIUM",barC:"bg-yellow-500",w:"32%"},
              ].map(r=>(
                <div key={r.sev} className="space-y-1.5">
                  <div className="flex justify-between text-zinc-500 font-medium">
                    <span>{r.sev}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                    <div className={`h-full rounded-full ${r.barC} shadow-[0_0_8px_currentColor]`} style={{width:r.w}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Card 3: Masked by Default (col-span-1) ── */}
        <div className="lg:col-span-1 group relative overflow-hidden panel-surface !rounded-3xl p-8 transition-all hover:bg-zinc-900/40 hover:border-zinc-700/60 flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex-1">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700/50 bg-zinc-800/50 text-zinc-300 shadow-[0_0_15px_rgba(161,161,170,0.1)]">
              <EyeOff className="h-6 w-6" />
            </div>
            {/* <h3 className="text-2xl font-bold text-zinc-100 mb-3">Masked by Default</h3> */}
            <h3 className="text-2xl font-bold text-zinc-100 mb-3">Raw Debug Mode</h3>
            <p className="text-zinc-400 leading-relaxed mb-6">
              {/* Secrets show only first/last 4 chars. Safe for screen-sharing and demos. */}
              Secrets are shown raw while masking is disabled for debugging.
            </p>
          </div>
          <div className="relative z-10 mt-auto">
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/30 backdrop-blur-sm p-4 shadow-xl">
              <div className="text-xs text-zinc-500 mb-2 font-mono">AWS Access Key</div>
              <div className="flex items-center gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/20 backdrop-blur-sm px-3 py-2 font-mono text-[11px]">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                {/* <span className="text-zinc-300 tracking-widest flex-1">AKIA••••••••WXYZ</span> */}
                <span className="text-zinc-300 flex-1 break-all">AKIAIOSFODNN7EXAMPLE</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 4: AI Remediation (col-span-2) ── */}
        <div className="lg:col-span-2 group relative overflow-hidden panel-surface !rounded-3xl p-8 transition-all hover:bg-zinc-900/40 hover:border-zinc-700/60">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col md:flex-row-reverse gap-10">
            <div className="md:w-[45%] flex flex-col justify-center">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-800/50 bg-emerald-950/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-100 mb-3">AI Remediation</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Gemini writes before/after code, .gitignore entries, and vault migration guides — for every finding.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Node.js","Django","Go"].map(ex=>(
                  <span key={ex} className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 text-emerald-400/80 px-3 py-1.5 font-mono text-xs">{ex}</span>
                ))}
              </div>
            </div>
            <div className="flex-1 rounded-xl border border-zinc-800/50 bg-zinc-950/30 backdrop-blur-sm overflow-hidden font-mono text-xs shadow-2xl">
              <div className="flex items-center gap-2 border-b border-zinc-800/50 px-4 py-3 bg-zinc-900/30 backdrop-blur-sm">
                <Bot className="h-4 w-4 text-emerald-400" />
                <span className="text-zinc-400 font-medium">ai_fix.diff</span>
              </div>
              <div className="p-4 space-y-1 text-[11px] leading-relaxed bg-zinc-950/20">
                <div className="bg-red-950/20 border-l-2 border-red-500/50 px-3 py-2 text-red-300/90">
                  <span className="opacity-50 mr-2">-</span> const key = &quot;AKIAQWERTY9...&quot;;
                </div>
                <div className="bg-emerald-950/20 border-l-2 border-emerald-500/50 px-3 py-2 text-emerald-300/90 mt-1">
                  <span className="opacity-50 mr-2">+</span> const key = process.env.AWS_KEY;
                </div>
                <div className="bg-zinc-900/20 border-l-2 border-zinc-700/50 px-3 py-2 text-zinc-400 mt-3">
                  <span className="text-zinc-500"># .gitignore</span><br/>
                  .env
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
