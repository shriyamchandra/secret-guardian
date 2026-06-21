import { ScanResult } from "@/types/scan";
import { CheckCircle2, Clock, AlertOctagon } from "lucide-react";

export const ScanSummaryCards = ({ scanResult }: { scanResult: ScanResult | null }) => {
  if (!scanResult) return null;
  const {
    total_findings,
    files_affected,
    severity_breakdown,
    scan_duration,
    has_critical,
    has_high,
    heuristics_stats,
    scan_incomplete,
    files_seen,
    files_scanned,
    files_skipped,
    skip_reasons,
    scanner_versions,
    suppressed_findings,
  } = scanResult;

  const signalsAnalyzed = heuristics_stats?.signals_analyzed ?? 0;
  const falsePositivesFiltered = heuristics_stats?.false_positives_filtered ?? 0;
  const scannerBreakdown = heuristics_stats?.scanner_breakdown ?? {};
  const hasScannerBreakdown = Object.keys(scannerBreakdown).length > 0;

  const hasSuppressedOrSkipped = Boolean(
    (suppressed_findings && suppressed_findings.length > 0) ||
    (files_skipped && files_skipped > 0)
  );
  const allClearLabel = hasSuppressedOrSkipped ? "No visible findings detected" : "All Clear!";

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
                <span className="text-sm font-semibold text-emerald-300">{allClearLabel}</span>
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

      {/* Walk Statistics */}
      {files_seen !== undefined && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="font-mono text-lg font-bold text-zinc-100">{files_seen}</div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-400">Total Files Seen</div>
          </div>
          <div className="interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="font-mono text-lg font-bold text-zinc-100">{files_scanned}</div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-400">Files Scanned</div>
          </div>
          <div className="interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="font-mono text-lg font-bold text-zinc-100">{files_skipped}</div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-400">Files Skipped</div>
          </div>
        </div>
      )}

      {/* Skip Reasons Breakdown */}
      {skip_reasons && Object.keys(skip_reasons).length > 0 && (
        <div className="mb-6 p-4 rounded-md border border-zinc-800 bg-zinc-900/30 text-xs text-zinc-400">
          <span className="font-semibold block mb-1">Skip reasons breakdown:</span>
          <ul className="list-disc list-inside space-y-0.5 font-mono">
            {Object.entries(skip_reasons).map(([reason, count]) => (
              <li key={reason}>
                {reason}: {count} file(s)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Incomplete Warning */}
      {scan_incomplete && (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-orange-850 bg-orange-950/30 px-5 py-4 text-orange-200">
          <AlertOctagon className="h-6 w-6 flex-shrink-0 text-orange-400" />
          <div>
            <div className="font-bold">⚠️ Scan Incomplete (Truncated)</div>
            <div className="text-sm text-orange-300">
              The repository or file count exceeds safe bounds. Scanning was stopped mid-process, meaning some credentials might have been missed.
            </div>
          </div>
        </div>
      )}

      {hasScannerBreakdown && (
        <div className="mb-6 p-4 rounded-md border border-zinc-800 bg-zinc-900/30 text-xs text-zinc-400">
          <span className="font-semibold block mb-2">Scanner breakdown (after heuristics):</span>
          <ul className="list-disc list-inside space-y-0.5 font-mono">
            {Object.entries(scannerBreakdown).map(([scanner, stats]) => (
              <li key={scanner}>
                {scanner}: {stats.emitted} emitted, {stats.visible} visible, {stats.suppressed} suppressed
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scanner Versions */}
      {scanner_versions && Object.keys(scanner_versions).length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 text-xs items-center text-zinc-500">
          <span className="font-semibold">Scanner Versions:</span>
          {Object.entries(scanner_versions).map(([name, ver]) => (
            <span key={name} className="border border-zinc-800 rounded px-2 py-0.5 bg-zinc-950 font-mono text-[10px]">
              {name}: v{ver}
            </span>
          ))}
        </div>
      )}

      {total_findings === 0 && (
        <div className="mb-6 rounded-md border border-emerald-700/70 bg-emerald-950/35 p-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/70 bg-emerald-900/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
            Security Health Check: {hasSuppressedOrSkipped ? "No visible findings detected" : "Passed"}
          </div>
          <p className="mt-3 text-sm text-emerald-200/90">
            Heuristics Engine analyzed <strong>{signalsAnalyzed}</strong> potential signals and filtered out <strong>{falsePositivesFiltered}</strong> false positives.
            {hasSuppressedOrSkipped && " Some files were skipped or findings were suppressed for noise reduction."}
          </p>
        </div>
      )}

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
