"use client";

import { useState } from "react";
import { Shield, ChevronDown } from "lucide-react";
import { ThreatContext } from "@/types/scan";
import { getActionLabel } from "@/lib/scan-utils";

export const ThreatContextDetails = ({ context }: { context?: ThreatContext }) => {
  const [expanded, setExpanded] = useState(false);

  if (!context) return null;

  return (
    <div className="mt-3 border-t border-zinc-700 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
      >
        <Shield className="h-4 w-4" />
        <span>Threat Analysis</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 text-sm">
          {/* Context Notes */}
          <div className="space-y-1">
            {context.context_notes.map((note, i) => (
              <div key={i} className="text-zinc-300 text-xs">
                {note}
              </div>
            ))}
          </div>

          {/* Risk Assessment Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-zinc-700 bg-zinc-900/70 p-2">
              <div className="text-zinc-500 mb-1">Risk Level</div>
              <div className="font-medium text-zinc-100">{context.risk_level}</div>
            </div>
            <div className="rounded-md border border-zinc-700 bg-zinc-900/70 p-2">
              <div className="text-zinc-500 mb-1">Recommended Action</div>
              <div className="font-medium text-zinc-100">{getActionLabel(context.recommended_action)}</div>
            </div>
            <div className="rounded-md border border-zinc-700 bg-zinc-900/70 p-2">
              <div className="text-zinc-500 mb-1">Confidence</div>
              <div className="font-medium text-zinc-100">{Math.round(context.confidence * 100)}%</div>
            </div>
            <div className="rounded-md border border-zinc-700 bg-zinc-900/70 p-2">
              <div className="text-zinc-500 mb-1">Assessment</div>
              <div className="font-medium text-zinc-100">{context.exploitability.replace(/_/g, ' ')}</div>
            </div>
          </div>

          {/* Risk Factors */}
          {context.risk_factors.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-red-300">⚠️ Risk Factors</div>
              <ul className="ml-4 list-disc space-y-0.5 text-xs text-zinc-400">
                {context.risk_factors.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {/* Mitigating Factors */}
          {context.mitigating_factors.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-emerald-300">✓ Mitigating Factors</div>
              <ul className="ml-4 list-disc space-y-0.5 text-xs text-zinc-400">
                {context.mitigating_factors.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
