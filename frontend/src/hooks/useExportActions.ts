"use client";

import { useState } from "react";

import { type ActionStatus } from "@/components/scan/ActionStatusBanner";
import { getErrorMessage, parseTimeoutMs } from "@/lib/scan-utils";
import { Finding, ScanResult } from "@/types/scan";

const EXPORT_REQUEST_TIMEOUT_MS = parseTimeoutMs(
  process.env.NEXT_PUBLIC_EXPORT_TIMEOUT_MS,
  30_000
);

interface ExportContext {
  scanResult: ScanResult | null;
  findings: Finding[];
  scanMode: "url" | "upload";
  uploadedFileName?: string;
  repoUrl: string;
  /** show the shared "copied" indicator (from useCopyFeedback) */
  markCopied: (key: string, ms: number) => void;
}

/** JSON/summary/log export actions with abortable requests and a shared
 * status banner. Bodies moved verbatim from app/scan/page.tsx. */
export function useExportActions({
  scanResult,
  findings,
  scanMode,
  uploadedFileName,
  repoUrl,
  markCopied,
}: ExportContext) {
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null);

  const buildExportPayload = () => {
    if (!scanResult) {
      return null;
    }

    const source = scanResult.source || (scanMode === "upload" ? "upload" : "repository_url");
    const target =
      scanResult.scan_target ||
      (source === "upload"
        ? scanResult.filename || uploadedFileName || "Uploaded ZIP file"
        : repoUrl.trim());

    return {
      findings,
      repo_url: source === "upload" ? "" : target,
      scan_duration: scanResult.scan_duration,
      severity_breakdown: scanResult.severity_breakdown,
      scan_source: source,
      scan_target: target,
      scanned_filename: scanResult.filename,
      uploaded_file_size_mb: scanResult.file_size_mb,
      scanners_used: scanResult.scanners_used || [],
      files_affected: scanResult.files_affected || 0,
      total_findings: scanResult.total_findings ?? findings.length,
      displayed_findings: scanResult.displayed_findings ?? findings.length,
      findings_truncated: Boolean(scanResult.findings_truncated),
    };
  };

  const exportJSON = async () => {
    if (!scanResult) return;
    const payload = buildExportPayload();
    if (!payload) return;

    setActionStatus(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      EXPORT_REQUEST_TIMEOUT_MS
    );

    try {
      // DEBUG: always request raw exports while masking is disabled.
      // const rawQuery = RAW_SECRET_DEBUG_ENABLED ? "?include_raw=true" : "";
      const rawQuery = "?include_raw=true";
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/export/json${rawQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            await response.json().catch(() => ({})),
            "Failed to export JSON"
          )
        );
      }

      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `secret-guardian-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionStatus({
        type: "success",
        message: "JSON report exported successfully.",
      });
    } catch (e: unknown) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      setActionStatus({
        type: "error",
        message: isAbort
          ? "Export timed out."
          : e instanceof Error
            ? e.message
            : "Failed to export JSON",
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const copySummary = async () => {
    if (!scanResult) return;
    const payload = buildExportPayload();
    if (!payload) return;

    setActionStatus(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      EXPORT_REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/export/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );
      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            await response.json().catch(() => ({})),
            "Failed to copy summary"
          )
        );
      }

      await navigator.clipboard.writeText((await response.json()).summary);
      markCopied("summary", 2000);
      setActionStatus({ type: "success", message: "Summary copied to clipboard." });
    } catch (e: unknown) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      setActionStatus({
        type: "error",
        message: isAbort
          ? "Copy timed out."
          : e instanceof Error
            ? e.message
            : "Failed to copy summary",
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const exportLog = async () => {
    if (!scanResult) return;
    const payload = buildExportPayload();
    if (!payload) return;

    setActionStatus(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      EXPORT_REQUEST_TIMEOUT_MS
    );

    try {
      // DEBUG: always request raw logs while masking is disabled.
      // const rawQuery = RAW_SECRET_DEBUG_ENABLED ? "?include_raw=true" : "";
      const rawQuery = "?include_raw=true";
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/export/log${rawQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            await response.json().catch(() => ({})),
            "Failed to export scan log"
          )
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secret-guardian-scan-log-${Date.now()}.log`;
      a.click();
      URL.revokeObjectURL(url);

      setActionStatus({
        type: "success",
        message: "Scan log downloaded successfully.",
      });
    } catch (e: unknown) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      setActionStatus({
        type: "error",
        message: isAbort
          ? "Log export timed out."
          : e instanceof Error
            ? e.message
            : "Failed to export scan log",
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const copyLog = async () => {
    if (!scanResult) return;
    const payload = buildExportPayload();
    if (!payload) return;

    setActionStatus(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      EXPORT_REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        // `${process.env.NEXT_PUBLIC_API_URL}/export/log${RAW_SECRET_DEBUG_ENABLED ? "?include_raw=true" : ""}`,
        `${process.env.NEXT_PUBLIC_API_URL}/export/log?include_raw=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            await response.json().catch(() => ({})),
            "Failed to copy scan log"
          )
        );
      }

      await navigator.clipboard.writeText(await response.text());
      markCopied("log", 2000);
      setActionStatus({
        type: "success",
        // message: RAW_SECRET_DEBUG_ENABLED
        //   ? "Scan log copied with raw debug values."
        //   : "Scan log copied with masked values.",
        message: "Scan log copied with raw debug values.",
      });
    } catch (e: unknown) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      setActionStatus({
        type: "error",
        message: isAbort
          ? "Copy log timed out."
          : e instanceof Error
            ? e.message
            : "Failed to copy scan log",
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  return {
    actionStatus,
    setActionStatus,
    exportJSON,
    copySummary,
    exportLog,
    copyLog,
  };
}
