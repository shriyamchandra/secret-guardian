"use client";

import Link from "next/link";
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
} from "lucide-react";

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
          <ul className="flex flex-grow flex-wrap items-center justify-end">
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
                className="ml-3 inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-xs tracking-wide text-zinc-100 transition-colors hover:border-orange-500 hover:bg-zinc-800"
              >
                Start Scanning
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </header>
);

const HeroSection = () => (
  <section className="relative overflow-hidden border-b border-zinc-800 bg-zinc-950 pb-12 pt-32 md:pb-20 md:pt-40">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(251,191,36,0.12),transparent_35%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.1),transparent_30%)]" />
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
      <div className="pb-12 text-center md:pb-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-emerald-800 bg-emerald-950/40 px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-emerald-300">
          <Lock className="h-4 w-4" />
          Read-Only Scanning :: No Data Stored
        </div>
        <h1 className="mb-4 font-sans text-5xl font-black leading-tight tracking-tight text-zinc-100 md:text-6xl">
          Protect Your Code.
          <br />
          <span className="bg-gradient-to-r from-orange-300 via-orange-200 to-emerald-300 bg-clip-text text-transparent">
            Stop API Key Leaks.
          </span>
        </h1>
        <div className="max-w-3xl mx-auto">
          <p className="mb-8 text-xl text-zinc-300">
            Scan public GitHub repositories or upload ZIP files to detect leaked secrets and get AI-powered remediation
            suggestions.
            <span className="mt-2 block text-base text-zinc-500">
              No GitHub authentication required for URL scans. ZIP uploads are supported for local or private code. No
              data stored. Completely free.
            </span>
          </p>
          <div className="mx-auto max-w-xs gap-4 sm:flex sm:max-w-none sm:justify-center">
            <Link
              className="mb-4 inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-6 py-3 font-mono text-sm tracking-wide text-zinc-100 transition-colors hover:border-orange-500 hover:bg-zinc-800 sm:mb-0 sm:w-auto"
              href="/scan"
            >
              <Shield className="h-5 w-5" />
              Start Scanning
            </Link>
            <a
              className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-zinc-800 bg-zinc-900/50 px-6 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100 sm:w-auto"
              href="#how-it-works"
            >
              <Eye className="h-5 w-5" />
              See How It Works
            </a>
          </div>
        </div>

        <div className="mt-12 max-w-2xl mx-auto">
          <div className="rounded-md border border-orange-800 bg-orange-950/30 p-4 text-sm text-orange-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-300" />
              <div className="text-left">
                <strong>v1 Limitation:</strong> Direct private GitHub repository scanning is not supported yet. Use ZIP
                upload for private code. Private repository scanning will be available in a future release.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const StatsSection = () => (
  <section className="border-y border-zinc-800 bg-zinc-950 py-12">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
        <div className="interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-2 font-mono text-4xl font-extrabold text-zinc-100">35+</div>
          <div className="text-sm font-medium uppercase tracking-wide text-zinc-400">Secret Types Detected</div>
        </div>
        <div className="interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-2 font-mono text-4xl font-extrabold text-zinc-100">3</div>
          <div className="text-sm font-medium uppercase tracking-wide text-zinc-400">Scanning Engines</div>
        </div>
        <div className="interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-2 font-mono text-4xl font-extrabold text-emerald-300">100%</div>
          <div className="text-sm font-medium uppercase tracking-wide text-zinc-400">Free to Use</div>
        </div>
        <div className="interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-2 font-mono text-4xl font-extrabold text-emerald-300">0</div>
          <div className="text-sm font-medium uppercase tracking-wide text-zinc-400">Data Stored</div>
        </div>
      </div>
    </div>
  </section>
);

const HowItWorksSection = () => (
  <section id="how-it-works" className="border-b border-zinc-800 bg-zinc-950 py-20">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-sans font-bold text-zinc-100">How It Works</h2>
        <p className="mt-2 text-zinc-400">Scan your repository in seconds, get actionable results.</p>
      </div>
      <div className="grid gap-8 md:grid-cols-4">
        <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 transition-transform duration-200 group-hover:scale-105">
            <Github className="h-6 w-6 text-zinc-200" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-zinc-100">1. Add Source</h3>
          <p className="text-zinc-400">Paste a public GitHub repository URL or upload a ZIP file.</p>
        </div>
        <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-orange-800 bg-orange-950/40 transition-transform duration-200 group-hover:scale-105">
            <Zap className="h-6 w-6 text-orange-300" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-zinc-100">2. Scan</h3>
          <p className="text-zinc-400">Multiple scanners analyze your code for secrets.</p>
        </div>
        <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-red-800 bg-red-950/40 transition-transform duration-200 group-hover:scale-105">
            <AlertTriangle className="h-6 w-6 text-red-300" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-zinc-100">3. Review</h3>
          <p className="text-zinc-400">See findings grouped by file with severity ratings.</p>
        </div>
        <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-emerald-800 bg-emerald-950/40 transition-transform duration-200 group-hover:scale-105">
            <Bot className="h-6 w-6 text-emerald-300" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-zinc-100">4. Fix</h3>
          <p className="text-zinc-400">Get AI-powered remediation suggestions for each finding.</p>
        </div>
      </div>
    </div>
  </section>
);

const FeaturesSection = () => (
  <section id="features" className="border-b border-zinc-800 bg-zinc-950 py-20">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-sans font-bold text-zinc-100">Powerful Security Features</h2>
        <p className="mt-2 text-zinc-400">Everything you need to find and fix leaked secrets.</p>
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-red-800 bg-red-950/50 text-red-200 transition-transform duration-200 group-hover:scale-105">
              <Key className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">35+ Secret Types</h3>
          </div>
          <p className="text-zinc-400">Detects AWS keys, GitHub tokens, API keys, database credentials, private keys, and more.</p>
        </div>
        <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-orange-800 bg-orange-950/50 text-orange-200 transition-transform duration-200 group-hover:scale-105">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">AI Remediation</h3>
          </div>
          <p className="text-zinc-400">Get framework-aware fix suggestions for Node.js, Python, Java, Go, and more.</p>
        </div>
        <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-orange-800 bg-orange-950/40 text-orange-200 transition-transform duration-200 group-hover:scale-105">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Entropy Detection</h3>
          </div>
          <p className="text-zinc-400">Uses Shannon entropy to find random-looking strings that may be custom secrets.</p>
        </div>
        <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-red-800 bg-red-950/50 text-red-200 transition-transform duration-200 group-hover:scale-105">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Severity Scoring</h3>
          </div>
          <p className="text-zinc-400">Critical, High, Medium, Low ratings help you prioritize what to fix first.</p>
        </div>
        <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-800 bg-emerald-950/50 text-emerald-200 transition-transform duration-200 group-hover:scale-105">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Masked by Default</h3>
          </div>
          <p className="text-zinc-400">All secrets are masked for safety. Reveal only when needed with a warning.</p>
        </div>
        <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-200 transition-transform duration-200 group-hover:scale-105">
              <FileJson className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Export Reports</h3>
          </div>
          <p className="text-zinc-400">Download JSON reports or copy summaries to clipboard for documentation.</p>
        </div>
      </div>
    </div>
  </section>
);

const TrustSection = () => (
  <section className="border-b border-zinc-800 bg-zinc-900/40 py-16 text-white">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-sans font-bold text-zinc-100">Built with Security in Mind</h2>
        <p className="mt-2 text-zinc-400">Your code is safe with us.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="group interactive-card flex items-center gap-4 rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
          <CheckCircle2 className="h-8 w-8 flex-shrink-0 text-emerald-400 transition-transform duration-200 group-hover:scale-105" />
          <div>
            <h4 className="font-bold text-zinc-100">Read-Only Scanning</h4>
            <p className="text-sm text-zinc-400">We never modify your code</p>
          </div>
        </div>
        <div className="group interactive-card flex items-center gap-4 rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
          <CheckCircle2 className="h-8 w-8 flex-shrink-0 text-emerald-400 transition-transform duration-200 group-hover:scale-105" />
          <div>
            <h4 className="font-bold text-zinc-100">No Data Storage</h4>
            <p className="text-sm text-zinc-400">Temp files deleted after scan</p>
          </div>
        </div>
        <div className="group interactive-card flex items-center gap-4 rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
          <CheckCircle2 className="h-8 w-8 flex-shrink-0 text-emerald-400 transition-transform duration-200 group-hover:scale-105" />
          <div>
            <h4 className="font-bold text-zinc-100">No Auth Required</h4>
            <p className="text-sm text-zinc-400">Works with public repos and ZIP uploads</p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const CTASection = () => (
  <section className="border-b border-zinc-800 bg-zinc-950 py-20 text-white">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
      <h2 className="mb-4 text-4xl font-sans font-extrabold text-zinc-100">Ready to Secure Your Code?</h2>
      <p className="mb-8 text-xl text-zinc-400">Find leaked secrets before hackers do. Start scanning in seconds.</p>
      <Link
        href="/scan"
        className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-8 py-4 font-mono text-sm tracking-wide text-zinc-100 transition-colors hover:border-orange-500 hover:bg-zinc-800"
      >
        <Shield className="h-6 w-6" />
        Start Scanning Free
      </Link>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-zinc-950 py-12 text-zinc-400">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <span className="text-lg font-bold text-zinc-100">Secret Guardian</span>
        </div>
        <div className="text-sm font-mono text-zinc-500">© 2025 Secret Guardian. Read-only scanning. No data stored.</div>
        <div className="flex gap-4">
          <a href="https://github.com" className="transition-colors hover:text-zinc-100">
            <Github className="h-5 w-5" />
          </a>
        </div>
      </div>
    </div>
  </footer>
);

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <Header />
      <main className="flex-grow">
        <HeroSection />
        <StatsSection />
        <HowItWorksSection />
        <FeaturesSection />
        <TrustSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
