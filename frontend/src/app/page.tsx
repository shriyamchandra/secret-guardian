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
  <header className="absolute top-0 left-0 w-full z-30">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="flex items-center justify-between h-20">
        <div className="flex-shrink-0 mr-4">
          <Link href="/" className="flex items-center" aria-label="Secret Guardian">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold tracking-tight text-gray-800">Secret Guardian</span>
          </Link>
        </div>
        <nav className="hidden md:flex md:flex-grow">
          <ul className="flex flex-grow justify-end flex-wrap items-center">
            <li>
              <a href="#features" className="text-gray-600 hover:text-gray-900 px-4 py-2 flex items-center transition duration-150 ease-in-out">
                Features
              </a>
            </li>
            <li>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 px-4 py-2 flex items-center transition duration-150 ease-in-out">
                How It Works
              </a>
            </li>
            <li>
              <Link href="/scan" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors h-9 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 ml-3">
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
  <section className="relative pt-32 pb-12 md:pt-40 md:pb-20 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="text-center pb-12 md:pb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-6">
          <Lock className="h-4 w-4" />
          Read-Only Scanning • No Data Stored
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tighter tracking-tighter mb-4">
          Protect Your Code.
          <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Stop API Key Leaks.</span>
        </h1>
        <div className="max-w-3xl mx-auto">
          <p className="text-xl text-gray-600 mb-8">
            Scan public GitHub repositories or upload ZIP files to detect leaked secrets and get AI-powered remediation suggestions.
            <span className="block mt-2 text-base text-gray-500">
              No GitHub authentication required for URL scans. ZIP uploads are supported for local or private code. No data stored. Completely free.
            </span>
          </p>
          <div className="max-w-xs mx-auto sm:max-w-none sm:flex sm:justify-center gap-4">
            <Link
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-semibold transition-all px-6 py-3 text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl w-full sm:w-auto mb-4 sm:mb-0"
              href="/scan"
            >
              <Shield className="h-5 w-5" />
              Start Scanning Now
            </Link>
            <a
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-medium transition-colors px-6 py-3 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 w-full sm:w-auto"
              href="#how-it-works"
            >
              <Eye className="h-5 w-5" />
              See How It Works
            </a>
          </div>
        </div>

        {/* Disclaimer Banner */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <strong>v1 Limitation:</strong> Direct private GitHub repository scanning is not supported yet. Use ZIP upload for private code.
                Private repository scanning will be available in a future release.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const StatsSection = () => (
  <section className="py-12 bg-white border-y border-gray-100">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        <div>
          <div className="text-4xl font-extrabold text-blue-600 mb-2">35+</div>
          <div className="text-gray-600 font-medium">Secret Types Detected</div>
        </div>
        <div>
          <div className="text-4xl font-extrabold text-blue-600 mb-2">3</div>
          <div className="text-gray-600 font-medium">Scanning Engines</div>
        </div>
        <div>
          <div className="text-4xl font-extrabold text-blue-600 mb-2">100%</div>
          <div className="text-gray-600 font-medium">Free to Use</div>
        </div>
        <div>
          <div className="text-4xl font-extrabold text-blue-600 mb-2">0</div>
          <div className="text-gray-600 font-medium">Data Stored</div>
        </div>
      </div>
    </div>
  </section>
);

const HowItWorksSection = () => (
  <section id="how-it-works" className="bg-gray-50 py-20">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-800">How It Works</h2>
        <p className="text-gray-600 mt-2">Scan your repository in seconds, get actionable results.</p>
      </div>
      <div className="grid gap-8 md:grid-cols-4">
        <div className="text-center p-6 bg-white rounded-xl shadow-md border border-gray-100">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mx-auto mb-4">
            <Github className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold mb-2">1. Add Source</h3>
          <p className="text-gray-600">Paste a public GitHub repository URL or upload a ZIP file.</p>
        </div>
        <div className="text-center p-6 bg-white rounded-xl shadow-md border border-gray-100">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mx-auto mb-4">
            <Zap className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold mb-2">2. Scan</h3>
          <p className="text-gray-600">Multiple scanners analyze your code for secrets.</p>
        </div>
        <div className="text-center p-6 bg-white rounded-xl shadow-md border border-gray-100">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold mb-2">3. Review</h3>
          <p className="text-gray-600">See findings grouped by file with severity ratings.</p>
        </div>
        <div className="text-center p-6 bg-white rounded-xl shadow-md border border-gray-100">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mx-auto mb-4">
            <Bot className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold mb-2">4. Fix</h3>
          <p className="text-gray-600">Get AI-powered remediation suggestions for each finding.</p>
        </div>
      </div>
    </div>
  </section>
);

const FeaturesSection = () => (
  <section id="features" className="py-20 bg-white">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-800">Powerful Security Features</h2>
        <p className="text-gray-600 mt-2">Everything you need to find and fix leaked secrets.</p>
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-600 text-white">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold">35+ Secret Types</h3>
          </div>
          <p className="text-gray-600">Detects AWS keys, GitHub tokens, API keys, database credentials, private keys, and more.</p>
        </div>
        <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-600 text-white">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold">AI Remediation</h3>
          </div>
          <p className="text-gray-600">Get framework-aware fix suggestions for Node.js, Python, Java, Go, and more.</p>
        </div>
        <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-600 text-white">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold">Entropy Detection</h3>
          </div>
          <p className="text-gray-600">Uses Shannon entropy to find random-looking strings that may be custom secrets.</p>
        </div>
        <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-600 text-white">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold">Severity Scoring</h3>
          </div>
          <p className="text-gray-600">Critical, High, Medium, Low ratings help you prioritize what to fix first.</p>
        </div>
        <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-indigo-600 text-white">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold">Masked by Default</h3>
          </div>
          <p className="text-gray-600">All secrets are masked for safety. Reveal only when needed with a warning.</p>
        </div>
        <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-600 text-white">
              <FileJson className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold">Export Reports</h3>
          </div>
          <p className="text-gray-600">Download JSON reports or copy summaries to clipboard for documentation.</p>
        </div>
      </div>
    </div>
  </section>
);

const TrustSection = () => (
  <section className="py-16 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold">Built with Security in Mind</h2>
        <p className="text-slate-300 mt-2">Your code is safe with us.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <CheckCircle2 className="w-8 h-8 text-green-400 flex-shrink-0" />
          <div>
            <h4 className="font-bold">Read-Only Scanning</h4>
            <p className="text-sm text-slate-400">We never modify your code</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <CheckCircle2 className="w-8 h-8 text-green-400 flex-shrink-0" />
          <div>
            <h4 className="font-bold">No Data Storage</h4>
            <p className="text-sm text-slate-400">Temp files deleted after scan</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <CheckCircle2 className="w-8 h-8 text-green-400 flex-shrink-0" />
          <div>
            <h4 className="font-bold">No Auth Required</h4>
            <p className="text-sm text-slate-400">Works with public repos and ZIP uploads</p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const CTASection = () => (
  <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
      <h2 className="text-4xl font-extrabold mb-4">Ready to Secure Your Code?</h2>
      <p className="text-xl text-blue-100 mb-8">
        Find leaked secrets before hackers do. Start scanning in seconds.
      </p>
      <Link
        href="/scan"
        className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold bg-white text-blue-600 rounded-xl shadow-xl hover:bg-blue-50 transition-all"
      >
        <Shield className="h-6 w-6" />
        Start Scanning Free
      </Link>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-slate-900 text-slate-400 py-12">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-500" />
          <span className="text-lg font-bold text-white">Secret Guardian</span>
        </div>
        <div className="text-sm">
          © 2025 Secret Guardian. Read-only scanning. No data stored.
        </div>
        <div className="flex gap-4">
          <a href="https://github.com" className="hover:text-white transition-colors">
            <Github className="h-5 w-5" />
          </a>
        </div>
      </div>
    </div>
  </footer>
);

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
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
