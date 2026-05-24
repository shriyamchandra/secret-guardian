"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Bot,
  Zap,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileJson,
  Shield,
  Github,
  Database,
  Key,
  Terminal,
  ChevronRight,
  Code2,
  Cpu,
  GitBranch,
  EyeOff,
  Copy,
  RotateCcw,
  ExternalLink,
  Layers,
  ArrowRight,
} from "lucide-react";

// ─── Terminal animation lines ───────────────────────────────────────────────

const TERMINAL_LINES = [
  { delay: 0,    color: "text-zinc-400",   text: "$ secret-guardian scan https://github.com/acme/backend" },
  { delay: 600,  color: "text-emerald-400", text: "✓ Cloning repository... done (312 files)" },
  { delay: 1200, color: "text-emerald-400", text: "✓ Running regex engine (800+ patterns)..." },
  { delay: 1800, color: "text-orange-300",  text: "✓ Running Gitleaks + TruffleHog scanners..." },
  { delay: 2400, color: "text-orange-300",  text: "✓ Applying heuristic noise filter..." },
  { delay: 3000, color: "text-red-400",     text: "[CRITICAL] AWS Access Key ID   src/config/aws.js:15" },
  { delay: 3400, color: "text-orange-400",  text: "[HIGH]     GitHub Token         .env:3" },
  { delay: 3800, color: "text-yellow-400",  text: "[MEDIUM]   Generic API Key      src/services/maps.js:42" },
  { delay: 4300, color: "text-emerald-400", text: "✓ Requesting AI remediation (Gemini)..." },
  { delay: 4900, color: "text-emerald-300", text: "✓ Scan complete — 3 secrets found in 3 files (~30s avg)" },
  { delay: 5300, color: "text-zinc-500",    text: "  No data stored. Repository deleted from server." },
];

function TerminalHero() {
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
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60 overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-zinc-700 bg-zinc-800 px-4 py-3">
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

// ─── Mock Finding Cards ──────────────────────────────────────────────────────

interface MockFinding {
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  type: string;
  file: string;
  line: number;
  masked: string;
  entropy: number;
  scanners: string[];
  exploitability: string;
  exploitColor: string;
  aiFixPreview: string;
  language: string;
}

const MOCK_FINDINGS: MockFinding[] = [
  {
    severity: "CRITICAL",
    type: "AWS Access Key ID",
    file: "src/config/aws.js",
    line: 15,
    masked: "AKIA••••••••WXYZ",
    entropy: 4.2,
    scanners: ["regex", "gitleaks"],
    exploitability: "EXPLOITABLE NOW",
    exploitColor: "text-red-300 bg-red-950/40 border-red-800",
    language: "JavaScript",
    aiFixPreview:
      "**🎯 Risk Assessment**: This is a real AWS credential that provides direct access to your cloud infrastructure. Rotate immediately via the AWS Console.\n\n**🔧 Secure Pattern**: Store in environment variables and use `process.env.AWS_ACCESS_KEY_ID` — never hardcode.",
  },
  {
    severity: "HIGH",
    type: "GitHub Personal Access Token",
    file: ".env",
    line: 3,
    masked: "ghp_••••••••••••••••R7mX",
    entropy: 5.1,
    scanners: ["regex", "trufflehog"],
    exploitability: "EXPLOITABLE NOW",
    exploitColor: "text-red-300 bg-red-950/40 border-red-800",
    language: "Shell",
    aiFixPreview:
      "**🎯 Risk Assessment**: GitHub PATs grant repo/org access. This token could allow unauthorized code commits or data exfiltration.\n\n**🔧 Secure Pattern**: Revoke at github.com/settings/tokens, then use GitHub Actions secrets or a vault.",
  },
  {
    severity: "MEDIUM",
    type: "Generic API Key",
    file: "src/services/maps.js",
    line: 42,
    masked: "AIza••••••••••••••••••••Tq8",
    entropy: 3.8,
    scanners: ["regex"],
    exploitability: "BAD PRACTICE",
    exploitColor: "text-orange-300 bg-orange-950/40 border-orange-800",
    language: "JavaScript",
    aiFixPreview:
      "**🎯 Risk Assessment**: Google Maps API keys with no domain restriction can be used to rack up charges on your account.\n\n**🔧 Secure Pattern**: Restrict key to specific referrer domains in the Google Cloud Console, then move to `.env.local`.",
  },
];

function SeverityBadge({ severity }: { severity: MockFinding["severity"] }) {
  const styles = {
    CRITICAL: "bg-red-950/60 border-red-700 text-red-300",
    HIGH: "bg-orange-950/60 border-orange-700 text-orange-300",
    MEDIUM: "bg-yellow-950/60 border-yellow-700 text-yellow-300",
  };
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[11px] font-bold tracking-widest ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function MockFindingCard({ finding, isExpanded, onToggle }: {
  finding: MockFinding;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 overflow-hidden transition-all duration-200 hover:border-zinc-700">
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          <AlertTriangle
            className={`h-5 w-5 ${
              finding.severity === "CRITICAL"
                ? "text-red-400"
                : finding.severity === "HIGH"
                ? "text-orange-400"
                : "text-yellow-400"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <SeverityBadge severity={finding.severity} />
            <span className="font-semibold text-zinc-100">{finding.type}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 font-mono">
            <span className="flex items-center gap-1">
              <Code2 className="h-3 w-3" />
              {finding.file}:{finding.line}
            </span>
            <span className="flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              entropy {finding.entropy}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {finding.scanners.join(" + ")}
            </span>
          </div>
        </div>
        <span className={`hidden sm:inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-mono tracking-wide flex-shrink-0 ${finding.exploitColor}`}>
          {finding.exploitability}
        </span>
      </div>

      {/* Secret value row */}
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm">
        <Lock className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
        <span className={revealed ? "text-amber-300 break-all" : "text-zinc-300 tracking-widest"}>
          {revealed ? "AKIAIOSFODNN7EXAMPLE" : finding.masked}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setRevealed((r) => !r)}
            className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
            title={revealed ? "Mask secret" : "Reveal secret (demo)"}
          >
            {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            <span>{revealed ? "Mask" : "Reveal"}</span>
          </button>
          <button className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors">
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Code snippet */}
      <div className="mx-4 mb-3 rounded-md border border-zinc-800 bg-zinc-950/80 overflow-x-auto">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-1.5">
          <Code2 className="h-3 w-3 text-zinc-600" />
          <span className="font-mono text-[11px] text-zinc-500">{finding.file} · line {finding.line}</span>
        </div>
        <div className="px-3 py-2 font-mono text-xs">
          <span className="text-zinc-600 select-none mr-3">{finding.line - 1}</span>
          <span className="text-zinc-500">{"// ..."}</span>
          <br />
          <span className="text-red-400 select-none mr-3 bg-red-950/20">{finding.line}</span>
          <span className="bg-red-950/30 text-red-300">
            {finding.type === "AWS Access Key ID"
              ? 'const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";'
              : finding.type === "GitHub Personal Access Token"
              ? 'GITHUB_TOKEN=ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ7mX'
              : 'const MAPS_KEY = "AIzaSyDXhfpuSP6GrTq8";'}
          </span>
        </div>
      </div>

      {/* AI Fix toggle */}
      <div className="mx-4 mb-4">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 hover:border-emerald-700 hover:bg-emerald-950/20 hover:text-emerald-300 transition-all"
        >
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-emerald-400" />
            <span className="font-medium">AI Remediation Guide</span>
          </div>
          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </button>

        {isExpanded && (
          <div className="mt-2 rounded-md border border-emerald-900 bg-emerald-950/20 px-4 py-3 text-sm text-zinc-300 space-y-2">
            {finding.aiFixPreview.split("\n\n").map((para, i) => (
              <p key={i} className="leading-relaxed">
                {para.replace(/\*\*(.*?)\*\*/g, "$1").split(/(\*\*.*?\*\*)/).map((part, j) =>
                  part.startsWith("**") ? (
                    <strong key={j} className="text-zinc-100">{part.replace(/\*\*/g, "")}</strong>
                  ) : (
                    part
                  )
                )}
              </p>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-emerald-900">
              <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-300 font-mono">ROTATE_NOW · Framework-specific guide included</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

const Header = () => (
  <header className="absolute top-0 left-0 z-30 w-full">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="flex h-20 items-center justify-between border-b border-zinc-800">
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

// ─── Hero Section ────────────────────────────────────────────────────────────

const HeroSection = () => (
  <section className="relative overflow-hidden border-b border-zinc-800 bg-zinc-950 pb-16 pt-32 md:pt-40">
    {/* Background glows */}
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(251,191,36,0.09),transparent_40%),radial-gradient(circle_at_85%_5%,rgba(16,185,129,0.08),transparent_35%)]" />
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(239,68,68,0.05),transparent_50%)]" />

    <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
        {/* Left: copy */}
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-emerald-300">
            <Lock className="h-3.5 w-3.5" />
            Read-Only · No Data Stored · 100% Free
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
              "800+ secret patterns: AWS, GitHub, Stripe, Google, SSH keys…",
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
            No GitHub auth required · ZIP upload for private repos · No data stored
          </p>
        </div>

        {/* Right: terminal */}
        <div>
          <TerminalHero />
          <p className="mt-3 text-center text-xs text-zinc-600 font-mono">
            ^ Simulated — real scans stream findings live
          </p>
        </div>
      </div>
    </div>
  </section>
);

// ─── Demo Results Section ────────────────────────────────────────────────────

function DemoSection() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <section id="demo" className="border-b border-zinc-800 bg-zinc-950 py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-orange-800 bg-orange-950/30 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-orange-300">
            <Terminal className="h-3.5 w-3.5" />
            Live Output Preview
          </div>
          <h2 className="text-3xl font-sans font-bold text-zinc-100">This Is What You Actually Get</h2>
          <p className="mt-3 max-w-xl mx-auto text-zinc-400">
            Real scan output — severity-rated findings, masked secrets, entropy scores, scanner sources, and AI-written fix guides — all in one view.
          </p>
        </div>

        {/* Scan summary bar */}
        <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-900/80 p-4">
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
          <p className="mt-3 text-xs text-zinc-600">No account. No auth. No data stored. Completely free.</p>
        </div>
      </div>
    </section>
  );
}

// ─── Detection Pipeline Section ──────────────────────────────────────────────

const DETECTION_STEPS = [
  {
    number: "01",
    icon: GitBranch,
    title: "Clone or Upload",
    color: "border-zinc-700 text-zinc-300",
    accentBg: "bg-zinc-800",
    description: "Paste a public repo URL (GitHub, GitLab, Bitbucket) or upload a ZIP. No credentials needed.",
    detail: (
      <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-400">
        <span className="text-zinc-600">$ </span>git clone https://github.com/acme/backend
        <br />
        <span className="text-emerald-400">✓ 312 files · 2.1 MB</span>
      </div>
    ),
  },
  {
    number: "02",
    icon: Cpu,
    title: "3 Scanners in Parallel",
    color: "border-orange-800 text-orange-300",
    accentBg: "bg-orange-950/30",
    description: "Regex patterns, Gitleaks, and TruffleHog run concurrently. Results are deduplicated.",
    detail: (
      <div className="mt-3 space-y-1">
        {[
          { name: "Regex Engine", count: "800+ patterns", color: "text-orange-300" },
          { name: "Gitleaks", count: "100+ rules", color: "text-yellow-300" },
          { name: "TruffleHog", count: "Entropy scan", color: "text-amber-300" },
        ].map((s) => (
          <div key={s.name} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5">
            <span className="font-mono text-xs text-zinc-400">{s.name}</span>
            <span className={`font-mono text-[11px] ${s.color}`}>{s.count}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: "03",
    icon: Database,
    title: "Heuristic Filtering",
    color: "border-zinc-600 text-zinc-300",
    accentBg: "bg-zinc-800",
    description: "Smart noise filtering drops test fixtures, placeholder strings, hex hashes, and known example credentials — so you see only real findings.",
    detail: (
      <div className="mt-3 space-y-1 font-mono text-xs">
        <div className="flex items-center gap-2 text-red-400"><span>✕</span><span className="line-through text-zinc-600">AKIAIOSFODNN7EXAMPLE (known example)</span></div>
        <div className="flex items-center gap-2 text-red-400"><span>✕</span><span className="line-through text-zinc-600">your-api-key-here (placeholder)</span></div>
        <div className="flex items-center gap-2 text-emerald-400"><span>✓</span><span className="text-zinc-300">AKIAQWERTY9ABCDEF1GH (real key)</span></div>
      </div>
    ),
  },
  {
    number: "04",
    icon: Bot,
    title: "AI Remediation",
    color: "border-emerald-800 text-emerald-300",
    accentBg: "bg-emerald-950/30",
    description: "Gemini AI (with local Qwen fallback) writes framework-specific fix code for each unique finding.",
    detail: (
      <div className="mt-3 rounded-md border border-emerald-900 bg-emerald-950/20 px-3 py-2 font-mono text-[11px]">
        <div className="text-red-400 mb-1">- const key = &quot;AKIA...&quot;;</div>
        <div className="text-emerald-400">+ const key = process.env.AWS_ACCESS_KEY_ID;</div>
        <div className="mt-1.5 text-zinc-600"># Add to .gitignore: .env</div>
      </div>
    ),
  },
];

const HowItWorksSection = () => (
  <section id="how-it-works" className="border-b border-zinc-800 bg-zinc-900/30 py-20">
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <div className="mb-14 text-center">
        <h2 className="text-3xl font-sans font-bold text-zinc-100">Detection in 4 Stages</h2>
        <p className="mt-3 text-zinc-400 max-w-lg mx-auto">
          Multiple engines, smart deduplication, and AI remediation — all in one scan.
        </p>
      </div>

      {/* Vertical timeline */}
      <div className="relative">
        {/* Spine line */}
        <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-zinc-700 via-orange-900/60 to-emerald-900/60 hidden sm:block" />

        <div className="space-y-0">
          {DETECTION_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === DETECTION_STEPS.length - 1;
            return (
              <div key={step.number} className="relative flex gap-6 sm:gap-10">
                {/* Node */}
                <div className="relative z-10 flex-shrink-0">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${step.color.split(" ")[0]} ${step.accentBg} shadow-lg shadow-black/40`}>
                    <Icon className={`h-5 w-5 ${step.color.split(" ")[1]}`} />
                  </div>
                </div>

                {/* Content */}
                <div className={`flex-1 pb-12 ${isLast ? "pb-0" : ""}`}>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-mono text-[11px] text-zinc-600 tracking-widest">{step.number}</span>
                    <h3 className="text-xl font-bold text-zinc-100">{step.title}</h3>
                  </div>
                  <p className="text-zinc-400 leading-relaxed mb-3">{step.description}</p>
                  {step.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);

// ─── Features Section ────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Key,
    title: "800+ Secret Types",
    color: "border-red-800 bg-red-950/50 text-red-200",
    description: "Detects AWS keys, GitHub tokens, API keys, database credentials, private keys, and more.",
    examples: ["AWS AKIA*", "GitHub ghp_*", "Stripe sk_live_*", "RSA/SSH keys", "MongoDB URIs"],
  },
  {
    icon: Bot,
    title: "AI Remediation",
    color: "border-orange-800 bg-orange-950/50 text-orange-200",
    description: "Gemini writes before/after code, .gitignore entries, and vault migration guides per finding.",
    examples: ["Spring Boot", "Node.js / Express", "Django / Flask", "Go", ".NET / Ruby on Rails"],
  },
  {
    icon: Database,
    title: "Shannon Entropy Detection",
    color: "border-yellow-800 bg-yellow-950/40 text-yellow-200",
    description: "Detects high-entropy random strings that don't match known patterns — custom secrets and tokens.",
    examples: ["Entropy > 4.5 = flagged", "Base64 secret detection", "Hex key detection"],
  },
  {
    icon: AlertTriangle,
    title: "Severity + Threat Context",
    color: "border-red-800 bg-red-950/50 text-red-200",
    description: "Critical / High / Medium / Low — plus Exploitable Now vs Bad Practice vs Likely Safe context.",
    examples: ["EXPLOITABLE NOW", "BAD PRACTICE", "LIKELY SAFE", "ROTATE_NOW action"],
  },
  {
    icon: EyeOff,
    title: "Masked by Default",
    color: "border-emerald-800 bg-emerald-950/50 text-emerald-200",
    description: "Secrets show only first/last 4 chars. Full reveal requires a click confirmation to prevent shoulder-surfing.",
    examples: ["AKIA••••••••WXYZ", "ghp_••••••••R7mX", "Click-to-reveal with warning"],
  },
  {
    icon: FileJson,
    title: "Export & Share",
    color: "border-zinc-700 bg-zinc-800 text-zinc-200",
    description: "Download full JSON reports or copy text summaries for tickets, audits, or security reviews.",
    examples: ["JSON export", "Text summary", "Structured scan log", "Debug mode"],
  },
];

const FeaturesSection = () => (
  <section id="features" className="border-b border-zinc-800 bg-zinc-950 py-20">
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <div className="mb-16">
        <h2 className="text-3xl font-sans font-bold text-zinc-100">Everything You Need to Find &amp; Fix Leaks</h2>
        <p className="mt-3 text-zinc-400">Engineered for signal, not noise.</p>
      </div>

      <div className="space-y-20">

        {/* ── Row 1: 800+ secret types ─────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-16">
          <div className="lg:w-[42%] flex-shrink-0">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-800 bg-red-950/50 text-red-200"><Key className="h-5 w-5" /></div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-3">800+ Secret Types</h3>
            <p className="text-zinc-400 leading-relaxed mb-5">Detects AWS keys, GitHub tokens, API keys, database credentials, private keys, and more.</p>
            <div className="flex flex-wrap gap-2">{["AWS AKIA*","GitHub ghp_*","Stripe sk_live_*","RSA/SSH keys","MongoDB URIs"].map(ex=><span key={ex} className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-xs text-zinc-500">{ex}</span>)}</div>
          </div>
          <div className="flex-1 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden font-mono text-xs">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5 bg-zinc-900">
              <div className="h-2 w-2 rounded-full bg-red-500/70" /><div className="h-2 w-2 rounded-full bg-yellow-500/70" /><div className="h-2 w-2 rounded-full bg-emerald-500/70" />
              <span className="ml-1 text-zinc-500">scan_results.log</span>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                {type:"AWS Access Key ID",val:"AKIA\u2022\u2022\u2022\u2022WXYZ",sev:"CRITICAL",c:"text-red-400"},
                {type:"GitHub PAT",val:"ghp_\u2022\u2022\u2022\u2022R7mX",sev:"HIGH",c:"text-orange-400"},
                {type:"Stripe Secret Key",val:"sk_live_\u2022\u2022\u2022\u2022",sev:"CRITICAL",c:"text-red-400"},
                {type:"RSA Private Key",val:"-----BEGIN RSA\u2026",sev:"CRITICAL",c:"text-red-400"},
                {type:"MongoDB URI",val:"mongodb+srv://\u2026",sev:"HIGH",c:"text-orange-400"},
                {type:"Google API Key",val:"AIza\u2022\u2022\u2022\u2022Tq8",sev:"MEDIUM",c:"text-yellow-400"},
              ].map(r=><div key={r.type} className="flex items-center justify-between gap-3">
                <span className="text-zinc-500 truncate flex-1">{r.type}</span>
                <span className="text-zinc-400">{r.val}</span>
                <span className={`${r.c} font-bold tracking-widest text-[10px]`}>{r.sev}</span>
              </div>)}
            </div>
          </div>
        </div>

        {/* ── Row 2: AI Remediation ────────────────────── */}
        <div className="flex flex-col lg:flex-row-reverse lg:items-center gap-10 lg:gap-16">
          <div className="lg:w-[42%] flex-shrink-0">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-orange-800 bg-orange-950/50 text-orange-200"><Bot className="h-5 w-5" /></div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-3">AI Remediation</h3>
            <p className="text-zinc-400 leading-relaxed mb-5">Gemini writes before/after code, .gitignore entries, and vault migration guides — for every finding, per framework.</p>
            <div className="flex flex-wrap gap-2">{["Node.js","Django","Spring Boot","Go","Ruby on Rails"].map(ex=><span key={ex} className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-xs text-zinc-500">{ex}</span>)}</div>
          </div>
          <div className="flex-1 min-w-0 rounded-xl border border-emerald-900 bg-zinc-950 overflow-hidden font-mono text-xs">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5 bg-zinc-900">
              <Bot className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-zinc-500">ai_fix.diff  ·  src/config/aws.js</span>
            </div>
            <div className="p-4 space-y-1">
              <div className="text-zinc-600 mb-2">{"// Before"}</div>
              <div className="bg-red-950/30 border-l-2 border-red-600 px-3 py-1.5 text-red-300">{"- const key = \"AKIAQWERTY9ABCDEF\";"}</div>
              <div className="text-zinc-600 my-2">{"// After"}</div>
              <div className="bg-emerald-950/30 border-l-2 border-emerald-600 px-3 py-1.5 text-emerald-300">{"+ const key = process.env.AWS_ACCESS_KEY_ID;"}</div>
              <div className="bg-zinc-900/60 border-l-2 border-zinc-700 px-3 py-1.5 text-zinc-400 mt-2">{"# .env"}</div>
              <div className="bg-zinc-900/60 border-l-2 border-zinc-700 px-3 py-1.5 text-zinc-400">{"  AWS_ACCESS_KEY_ID=your_key_here"}</div>
              <div className="bg-zinc-900/60 border-l-2 border-zinc-700 px-3 py-1.5 text-zinc-400">{"# .gitignore  →  .env"}</div>
            </div>
          </div>
        </div>

        {/* ── Row 3: Severity + Threat Context ─────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-16">
          <div className="lg:w-[42%] flex-shrink-0">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-800 bg-red-950/50 text-red-200"><AlertTriangle className="h-5 w-5" /></div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-3">Severity &amp; Threat Context</h3>
            <p className="text-zinc-400 leading-relaxed mb-5">Critical / High / Medium / Low ratings — plus whether a finding is exploitable right now, bad practice, or likely a false positive.</p>
            <div className="flex flex-wrap gap-2">{["EXPLOITABLE NOW","BAD PRACTICE","LIKELY SAFE","ROTATE_NOW"].map(ex=><span key={ex} className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-xs text-zinc-500">{ex}</span>)}</div>
          </div>
          <div className="flex-1 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden font-mono text-xs">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5 bg-zinc-900">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-zinc-500">threat_context.log</span>
            </div>
            <div className="p-4 space-y-3">
              {[
                {sev:"CRITICAL",label:"EXPLOITABLE NOW",barC:"bg-red-600",textC:"text-red-300",bg:"bg-red-950/30 border-red-900",w:"33%"},
                {sev:"HIGH",label:"EXPLOITABLE NOW",barC:"bg-orange-600",textC:"text-orange-300",bg:"bg-orange-950/30 border-orange-900",w:"33%"},
                {sev:"MEDIUM",label:"BAD PRACTICE",barC:"bg-yellow-600",textC:"text-yellow-300",bg:"bg-yellow-950/30 border-yellow-900",w:"33%"},
              ].map(r=><div key={r.sev} className={`rounded-lg border p-3 ${r.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-bold tracking-widest text-[10px] ${r.textC}`}>{r.sev}</span>
                  <span className="text-zinc-500">{r.label}</span>
                </div>
                <div className="h-1 rounded-full bg-zinc-800"><div className={`h-1 rounded-full ${r.barC}`} style={{width:r.w}} /></div>
              </div>)}
              <div className="pt-1 border-t border-zinc-800 text-zinc-500">→ Recommended action: <span className="text-emerald-300">ROTATE_NOW</span></div>
            </div>
          </div>
        </div>

        {/* ── Row 4: Masked + Export (two tight columns, no grid keyword) ── */}
        <div className="flex flex-col lg:flex-row-reverse lg:items-start gap-10 lg:gap-16">
          <div className="lg:w-[42%] flex-shrink-0 space-y-8">
            <div>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-800 bg-emerald-950/50 text-emerald-200"><EyeOff className="h-5 w-5" /></div>
              <h3 className="text-xl font-bold text-zinc-100 mb-2">Masked by Default</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">Secrets show only first/last 4 chars. Reveal requires a click confirmation — safe for screen-sharing and demos.</p>
            </div>
            <div>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-200"><FileJson className="h-5 w-5" /></div>
              <h3 className="text-xl font-bold text-zinc-100 mb-2">Export Reports</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">Download JSON, copy a text summary, or export a structured scan log for your ticket or audit trail.</p>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden font-mono text-xs">
              <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5 bg-zinc-900">
                <EyeOff className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-zinc-500">secret_masking.log</span>
              </div>
              <div className="p-4 space-y-2.5">
                {[
                  {label:"AWS Access Key ID",masked:"AKIA\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022WXYZ"},
                  {label:"GitHub PAT",masked:"ghp_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022R7mX"},
                ].map(r=><div key={r.label}>
                  <div className="text-zinc-600 mb-1">{r.label}</div>
                  <div className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5">
                    <Lock className="h-3 w-3 text-zinc-600" />
                    <span className="text-zinc-300 tracking-widest flex-1">{r.masked}</span>
                    <span className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500"><Eye className="h-2.5 w-2.5" /> Reveal</span>
                  </div>
                </div>)}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden font-mono text-xs">
              <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5 bg-zinc-900">
                <FileJson className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-zinc-500">report.json</span>
              </div>
              <pre className="p-4 text-zinc-400 leading-relaxed overflow-hidden">{`{\n  "total_findings": 3,\n  "severity_breakdown": { "CRITICAL": 1, "HIGH": 1, "MEDIUM": 1 },\n  "scanners_used": ["regex", "gitleaks"],\n  "scan_duration": "~30s"\n}`}</pre>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>
);

// ─── Trust Section ───────────────────────────────────────────────────────────

const TRUST_ITEMS = [
  {
    icon: Lock,
    title: "Read-Only Scanning",
    desc: "We clone, scan, then delete. We never modify your code or commit anything.",
  },
  {
    icon: Shield,
    title: "Zero Data Retention",
    desc: "Repository files are deleted from the server the moment scanning completes.",
  },
  {
    icon: Zap,
    title: "No Auth Required",
    desc: "Public repos work without any GitHub/GitLab/Bitbucket authentication.",
  },
  {
    icon: Database,
    title: "Anti-Zip-Bomb Guards",
    desc: "100:1 ratio limit, 10MB per file, 200MB total. Path traversal prevention.",
  },
  {
    icon: AlertTriangle,
    title: "Rate Limited",
    desc: "Token bucket: 10 scans/min, 100/hr per IP. Prevents abuse.",
  },
  {
    icon: ExternalLink,
    title: "Open Source Spirit",
    desc: "Built transparently. Architecture blueprints and design decisions documented.",
  },
];

const TrustSection = () => (
  <section className="border-b border-zinc-800 bg-zinc-900/30 py-16">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-sans font-bold text-zinc-100">Built with Security-First Principles</h2>
          <p className="mt-2 text-zinc-400">Your code is safe. Here&apos;s exactly how.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="text-sm text-emerald-300 font-mono">All {TRUST_ITEMS.length} controls active</span>
        </div>
      </div>

      {/* Horizontal divider list — no cards */}
      <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
        {TRUST_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="group flex items-center gap-5 px-6 py-4 bg-zinc-900/40 hover:bg-zinc-800/40 transition-colors">
              <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 group-hover:border-emerald-800 transition-colors">
                <Icon className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-zinc-100">{item.title}</span>
                <span className="hidden sm:inline text-zinc-600 mx-3">—</span>
                <span className="block sm:inline text-sm text-zinc-400 mt-0.5 sm:mt-0">{item.desc}</span>
              </div>
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

// ─── CTA Section ─────────────────────────────────────────────────────────────

const CTASection = () => (
  <section className="relative border-b border-zinc-800 bg-zinc-950 py-24 overflow-hidden">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(16,185,129,0.08),transparent_55%),radial-gradient(circle_at_20%_40%,rgba(251,191,36,0.06),transparent_40%)]" />
    <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
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
        No account · No data stored · Read-only · Works on public repos
      </p>
    </div>
  </section>
);

// ─── Footer ──────────────────────────────────────────────────────────────────

const Footer = () => (
  <footer className="bg-zinc-950 py-10 text-zinc-400">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <span className="text-lg font-bold text-zinc-100">Secret Guardian</span>
        </div>
        <div className="text-sm font-mono text-zinc-500">
          © 2025 Secret Guardian · Read-only scanning · No data stored · MIT License
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <Header />
      <main className="flex-grow">
        <HeroSection />
        <DemoSection />
        <HowItWorksSection />
        <FeaturesSection />
        <TrustSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
