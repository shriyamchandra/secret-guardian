"use client";

import { useState } from "react";
import {
  Bot,
  Lock,
  AlertTriangle,
  Eye,
  ChevronRight,
  Code2,
  Cpu,
  Copy,
  RotateCcw,
  Layers,
} from "lucide-react";
// ─── Mock Finding Cards ──────────────────────────────────────────────────────

export interface MockFinding {
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

export const MOCK_FINDINGS: MockFinding[] = [
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

export function MockFindingCard({ finding, isExpanded, onToggle }: {
  finding: MockFinding;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  void revealed;

  return (
    <div className="panel-surface overflow-hidden transition-all duration-200 hover:border-zinc-700/80">
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
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950/30 backdrop-blur-sm px-3 py-2 font-mono text-sm">
        <Lock className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
        {/* DEBUG: demo masking is temporarily disabled. */}
        {/* <span className={revealed ? "text-amber-300 break-all" : "text-zinc-300 tracking-widest"}> */}
        <span className="text-amber-300 break-all">
          {/* {revealed ? "AKIAIOSFODNN7EXAMPLE" : finding.masked} */}
          AKIAIOSFODNN7EXAMPLE
        </span>
        <div className="ml-auto flex items-center gap-1">
          {/* title={revealed ? "Mask secret" : "Reveal secret (demo)"} */}
          <button
            onClick={() => setRevealed((r) => !r)}
            className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Raw debug value shown"
          >
            {/* {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} */}
            <Eye className="h-3 w-3" />
            {/* <span>{revealed ? "Mask" : "Reveal"}</span> */}
            <span>Raw</span>
          </button>
          <button className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors">
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Code snippet */}
      <div className="mx-4 mb-3 rounded-md border border-zinc-800/50 bg-zinc-950/40 backdrop-blur-sm overflow-x-auto">
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
          className="flex w-full items-center justify-between rounded-md border border-zinc-700 bg-zinc-800/30 px-3 py-2 text-sm text-zinc-300 hover:border-emerald-700 hover:bg-emerald-950/20 hover:text-emerald-300 transition-all"
        >
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-emerald-400" />
            <span className="font-medium">AI Remediation Guide</span>
          </div>
          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </button>

        {isExpanded && (
          <div className="mt-2 rounded-md border border-emerald-900 bg-emerald-950/15 px-4 py-3 text-sm text-zinc-300 space-y-2">
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
