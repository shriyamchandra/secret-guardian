"use client";

import {
  ActionStatusBanner,
  type ActionStatus,
} from "@/components/scan/ActionStatusBanner";
import { ScanResult } from "@/types/scan";
import { AlertTriangle, Filter, Loader2, ShieldCheck } from "lucide-react";

interface ScanStatusMeta {
  tone: string;
  title: string;
  message: string;
}

interface ScanStatusPanelProps {
  error: string;
  loading: boolean;
  progress: string;
  headerSubtitle: string;
  actionStatus: ActionStatus | null;
  onDismissStatus: () => void;
  scanStatusMeta: ScanStatusMeta;
  scanResult: ScanResult | null;
  totalFindings: number;
}

/** Subtitle line, action-status banner, and the tone-coded scan status box. */
export function ScanStatusPanel({
  error,
  loading,
  progress,
  headerSubtitle,
  actionStatus,
  onDismissStatus,
  scanStatusMeta,
  scanResult,
  totalFindings,
}: ScanStatusPanelProps) {
  return (
    <>
      <div className="mt-3 min-h-[1.5rem]">
        {!error && !loading && (
          <p
            className={`text-sm font-medium leading-6 break-words transition-colors duration-200 ${error ? "text-red-300" : loading ? "text-orange-300 animate-pulse" : scanResult?.has_critical || scanResult?.has_high ? "text-red-300" : "text-zinc-400"}`}
          >
            {headerSubtitle}
          </p>
        )}
        <p className="sr-only" aria-live="polite">
          {loading ? (progress || "Scanning...") : headerSubtitle}
        </p>
        <ActionStatusBanner status={actionStatus} onDismiss={onDismissStatus} />
      </div>

      <div
        className={`mt-4 rounded-md border p-4 ${scanStatusMeta.tone}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          {loading ? (
            <Loader2 className="mt-0.5 h-5 w-5 flex-shrink-0 animate-spin" />
          ) : scanResult && totalFindings === 0 ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
          ) : scanResult && (scanResult.has_critical || scanResult.has_high) ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          ) : (
            <Filter className="mt-0.5 h-5 w-5 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">{scanStatusMeta.title}</p>
            <p className="mt-1 text-sm opacity-90">{scanStatusMeta.message}</p>
          </div>
        </div>
      </div>
    </>
  );
}
