"use client";

import { VulnerabilityCard } from "@/components/scan/VulnerabilityCard";
import { getStableFindingKey } from "@/lib/finding-filters";
import { Finding } from "@/types/scan";
import { Shield } from "lucide-react";

interface SuppressedFindingsSectionProps {
  suppressedFindings: Finding[];
  expanded: boolean;
  onToggleExpanded: () => void;
  revealedSecrets: Record<string, string>;
  copiedKey: string | null;
  toggleRevealSecret: (key: string, secretFingerprint?: string) => void;
  copyText: (text: string, key: string) => void;
}

/** Collapsible list of suppressed / needs-review findings. */
export function SuppressedFindingsSection({
  suppressedFindings,
  expanded,
  onToggleExpanded,
  revealedSecrets,
  copiedKey,
  toggleRevealSecret,
  copyText,
}: SuppressedFindingsSectionProps) {
  if (suppressedFindings.length === 0) {
    return null;
  }

  return (
    <div className="panel-surface p-6 space-y-4 mt-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-yellow-450" />
          <h2 className="text-xl font-bold text-zinc-100">
            Suppressed / Needs Review Findings
          </h2>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-300 font-mono">
            {suppressedFindings.length}
          </span>
        </div>
        <button
          onClick={onToggleExpanded}
          className="text-xs text-orange-400 hover:text-orange-300 font-medium"
        >
          {expanded ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          {suppressedFindings.map((finding, idx) => {
            const findingKey = getStableFindingKey(finding) + "-suppressed-" + idx;
            return (
              <VulnerabilityCard
                key={findingKey}
                finding={finding}
                findingKey={findingKey}
                revealedValue={revealedSecrets[findingKey]}
                copiedKey={copiedKey}
                toggleRevealSecret={toggleRevealSecret}
                copyText={copyText}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
