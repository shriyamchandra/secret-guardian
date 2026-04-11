import { ScanResult } from "@/types/scan";
import { CheckCircle2, Clock, AlertOctagon } from "lucide-react";

export const ScanSummaryCards = ({ scanResult }: { scanResult: ScanResult | null }) => {
  if (!scanResult) return null;
  const { total_findings, files_affected, severity_breakdown, scan_duration, has_critical, has_high } = scanResult;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Total Findings */}
        <div className={`interactive-card rounded-md border p-4 ${has_critical ? "bg-red-950/50 border-red-800" :
          has_high ? "bg-red-950/35 border-red-900" :
            total_findings > 0 ? "bg-orange-950/35 border-orange-800" :
              "bg-emerald-950/35 border-emerald-800"
          }`}>
          <div className="font-mono text-2xl font-bold text-zinc-100">{total_findings}</div>
          <div className="text-xs uppercase tracking-wide text-zinc-400">Secrets Found</div>
        </div>

        {/* Files Affected */}
        <div className="interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="font-mono text-2xl font-bold text-zinc-100">{files_affected}</div>
          <div className="text-xs uppercase tracking-wide text-zinc-400">Files Affected</div>
        </div>

        {/* Severity Breakdown */}
        <div className="interactive-card col-span-2 rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-2 text-xs font-mono uppercase tracking-wide text-zinc-400">Severity Breakdown</div>
          <div className="flex gap-3">
            {severity_breakdown.CRITICAL > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-600"></span>
                <span className="text-sm font-semibold text-red-200">{severity_breakdown.CRITICAL} Critical</span>
              </div>
            )}
            {severity_breakdown.HIGH > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-sm font-semibold text-red-300">{severity_breakdown.HIGH} High</span>
              </div>
            )}
            {severity_breakdown.MEDIUM > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span className="text-sm font-semibold text-orange-200">{severity_breakdown.MEDIUM} Medium</span>
              </div>
            )}
            {severity_breakdown.LOW > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                <span className="text-sm font-semibold text-orange-300">{severity_breakdown.LOW} Low</span>
              </div>
            )}
            {total_findings === 0 && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-semibold text-emerald-300">All Clear!</span>
              </div>
            )}
          </div>
        </div>

        {/* Scan Duration */}
        <div className="interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-500" />
            <span className="font-mono text-2xl font-bold text-zinc-100">{scan_duration}s</span>
          </div>
          <div className="text-xs uppercase tracking-wide text-zinc-400">Scan Duration</div>
        </div>
      </div>

      {/* High Risk Warning */}
      {(has_critical || has_high) && (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-red-800 bg-red-950/45 px-5 py-4 text-red-200">
          <AlertOctagon className="h-6 w-6 flex-shrink-0" />
          <div>
            <div className="font-bold">⚠️ High-Risk Secrets Detected!</div>
            <div className="text-sm text-red-300">
              Rotate these secrets immediately. They may already be compromised.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
