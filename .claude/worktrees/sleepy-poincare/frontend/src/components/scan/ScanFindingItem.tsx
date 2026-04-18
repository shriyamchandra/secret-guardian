"use client";

import { Finding } from "@/types/scan";
import { getSeverityColor, getSeverityIcon, maskSecret } from "@/lib/scan-utils";
import { EducationTooltip } from "./EducationTooltip";
import { ThreatContextBadge } from "./ThreatContextBadge";
import { ThreatContextDetails } from "./ThreatContextDetails";
import { EyeOff, Eye, CheckCircle2, Copy, Lock, Shield, Zap, AlertCircle } from "lucide-react";
import { AIResponseMarkdown } from "@/components/AIResponseMarkdown";

interface ScanFindingItemProps {
  finding: Finding;
  findingKey: string;
  isRevealed: boolean;
  copiedKey: string | null;
  toggleRevealSecret: (key: string) => void;
  copyText: (text: string, key: string) => void;
}

export const ScanFindingItem = ({
  finding: f,
  findingKey: key,
  isRevealed,
  copiedKey,
  toggleRevealSecret,
  copyText,
}: ScanFindingItemProps) => {
  const canReveal = Boolean(f.raw_value && String(f.raw_value).trim().length > 0);

  return (
    <div className="p-5">
      {/* Finding Header */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold ${getSeverityColor(
            f.severity
          )}`}
        >
          {getSeverityIcon(f.severity)}
          {f.severity || "UNKNOWN"}
        </span>
        {/* Threat Context Badge */}
        <ThreatContextBadge context={f.threat_context} />
        <span className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-xs font-medium text-zinc-300">
          Line {f.line_number}
        </span>
        <span className="inline-flex items-center rounded-md border border-orange-800 bg-orange-950/45 px-3 py-1 text-xs font-medium text-orange-200">
          {f.secret_type}
        </span>
        {f.confidence && (
          <span className="inline-flex items-center rounded-md border border-orange-900 bg-orange-950/30 px-3 py-1 text-xs font-medium text-orange-300">
            {f.confidence} Confidence
          </span>
        )}
        {f.entropy !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-md border border-orange-900 bg-orange-950/30 px-3 py-1 text-xs font-medium text-orange-300">
            Entropy: {f.entropy}
            <EducationTooltip topic="entropy" />
          </span>
        )}
        {f.scanner_source && (
          <span className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-xs font-medium text-zinc-400">
            via {f.scanner_source}
          </span>
        )}
        {f.ai_fix?.suggestion && (
          <span className="inline-flex items-center rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300">
            Remediation Ready
          </span>
        )}
        {f.ai_fix?.error && (
          <span className="inline-flex items-center rounded-md border border-orange-800 bg-orange-950/40 px-3 py-1 text-xs font-medium text-orange-300">
            Remediation Limited
          </span>
        )}
      </div>

      {/* Code Viewer */}
      <div className="mb-4 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <div className="h-3 w-3 rounded-full bg-orange-500"></div>
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
            </div>
            <span className="ml-2 font-mono text-xs font-medium text-zinc-500">
              {f.file_path.split("/").pop()} • Line {f.line_number}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-mono font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => canReveal && toggleRevealSecret(key)}
              aria-label={
                canReveal
                  ? isRevealed
                    ? "Hide detected value"
                    : "Reveal detected value"
                  : "Detected value unavailable"
              }
              disabled={!canReveal}
            >
              {!canReveal ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Unavailable
                </>
              ) : isRevealed ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Reveal
                </>
              )}
            </button>
            <button
              className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-mono font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
              onClick={() => copyText(f.raw_value ? maskSecret(f.raw_value, false) : "", key + "-copy")}
              aria-label="Copy masked value"
            >
              {copiedKey === key + "-copy" ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy (Masked)
                </>
              )}
            </button>
          </div>
        </div>
        <pre className="max-h-60 overflow-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-zinc-100">
          {f.code_snippet || f.leaked_line}
        </pre>
      </div>

      {/* Masked Secret Display */}
      {f.raw_value && (
        <div className="mb-4 rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-300">Detected Value:</span>
              <EducationTooltip topic="masking" />
            </div>
            <span className="font-mono text-sm text-zinc-100">
              {maskSecret(f.raw_value, isRevealed)}
            </span>
          </div>
        </div>
      )}

      {/* Threat Context Analysis */}
      {f.threat_context && (
        <div className="mb-4 rounded-md border border-zinc-800 bg-zinc-900 p-4 text-zinc-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-300" />
              <span className="text-sm font-semibold">Threat Analysis</span>
            </div>
            <ThreatContextBadge context={f.threat_context} />
          </div>

          {/* Quick Summary */}
          <div className="mb-3 text-sm text-zinc-300">
            {f.threat_context.context_notes[0]}
          </div>

          {/* Expandable Details */}
          <ThreatContextDetails context={f.threat_context} />
        </div>
      )}

      {/* AI Recommendation */}
      {f.ai_fix?.suggestion && (
        <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/90 px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-orange-800 bg-orange-950/50">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-zinc-100">AI Security Recommendation</span>
          </div>
          <div className="p-5 max-h-[600px] overflow-y-auto prose prose-sm max-w-none">
            <AIResponseMarkdown content={f.ai_fix.suggestion} />
          </div>
        </div>
      )}

      {f.ai_fix?.error && (
        <div className="rounded-md border border-orange-800 bg-orange-950/40 p-4">
          <div className="flex items-center gap-2 text-orange-200">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">AI recommendation unavailable: {f.ai_fix.error}</span>
          </div>
        </div>
      )}
    </div>
  );
};
