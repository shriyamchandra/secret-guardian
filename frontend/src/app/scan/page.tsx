"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ActionStatusBanner,
  type ActionStatus,
} from "@/components/scan/ActionStatusBanner";
import { useScanStream } from "@/hooks/useScanStream";
import {
  getErrorMessage,
  isSupportedRepoUrl,
  parseTimeoutMs,
  severityRank,
} from "@/lib/scan-utils";
import { ScanSummaryCards } from "@/components/scan/ScanSummaryCards";
import { VulnerabilityCard } from "@/components/scan/VulnerabilityCard";
import { Finding, Severity } from "@/types/scan";
import {
  ArrowUpDown,
  CheckCircle2,
  Clipboard,
  FileJson,
  FileText,
  Filter,
  FolderArchive,
  Github,
  Loader2,
  Lock,
  Search,
  Shield,
  ShieldCheck,
  Upload,
  X,
  Zap,
  AlertTriangle,
} from "lucide-react";

const SCAN_REQUEST_TIMEOUT_MS = parseTimeoutMs(
  process.env.NEXT_PUBLIC_SCAN_TIMEOUT_MS,
  300_000
);
const EXPORT_REQUEST_TIMEOUT_MS = parseTimeoutMs(
  process.env.NEXT_PUBLIC_EXPORT_TIMEOUT_MS,
  30_000
);
const FINDINGS_BATCH_SIZE = 25;

type SortOption = "risk-desc" | "count-desc" | "file-asc" | "file-desc";

const getOccurrenceCount = (finding: Finding) =>
  finding.occurrence_count ?? finding.occurrences?.length ?? 1;

const getPrimaryPath = (finding: Finding) =>
  finding.occurrences?.[0]?.file_path || finding.file_path || "";

const DEFAULT_SEVERITY_SELECTION: Record<Severity, boolean> = {
  CRITICAL: true,
  HIGH: true,
  MEDIUM: true,
  LOW: true,
};

const getFileExtension = (path: string) => {
  const fileName = path.split("/").pop() || "";
  if (!fileName) return "(unknown)";

  if (fileName.startsWith(".") && !fileName.slice(1).includes(".")) {
    return fileName.toLowerCase();
  }

  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return "(no ext)";
  }
  return fileName.slice(dotIndex).toLowerCase();
};

const getScannerSources = (finding: Finding) => {
  if (finding.source_scanners?.length) {
    return finding.source_scanners
      .map((source) => source.toLowerCase())
      .filter(Boolean);
  }

  const source = String(finding.scanner_source || "").toLowerCase();
  return source ? [source] : [];
};

const getStableFindingKey = (finding: Finding) => {
  const occurrenceKey = (finding.occurrences || [])
    .map((occurrence) => `${occurrence.file_path}:${occurrence.line_number}`)
    .join(",");

  return [
    finding.raw_value || "",
    finding.secret_type || "",
    finding.file_path || "",
    String(finding.line_number || 0),
    occurrenceKey,
  ].join("|");
};

export default function ScanPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [scanMode, setScanMode] = useState<"url" | "upload">("url");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [findingSearch, setFindingSearch] = useState("");
  const [selectedSeverities, setSelectedSeverities] = useState<
    Record<Severity, boolean>
  >({ ...DEFAULT_SEVERITY_SELECTION });
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [selectedScanners, setSelectedScanners] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("risk-desc");
  const [visibleCount, setVisibleCount] = useState(FINDINGS_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const {
    scanResult,
    loading,
    error,
    progress,
    runUploadScan,
    runUrlScan,
    cancelScan,
    setError,
  } = useScanStream(SCAN_REQUEST_TIMEOUT_MS);

  const findings = useMemo(() => scanResult?.findings || [], [scanResult]);
  const displayedFindings = findings.length;
  const totalFindings = scanResult?.total_findings ?? displayedFindings;

  const severityCounts = useMemo(
    () =>
      scanResult?.severity_breakdown ?? {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      },
    [scanResult]
  );

  const fileTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(findings.map((finding) => getFileExtension(getPrimaryPath(finding))))
      ).sort((a, b) => a.localeCompare(b)),
    [findings]
  );

  const scannerOptions = useMemo(
    () =>
      Array.from(new Set(findings.flatMap((finding) => getScannerSources(finding))))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [findings]
  );

  const filteredFindings = useMemo(() => {
    const query = findingSearch.trim().toLowerCase();
    const selectedScannerSet = new Set(
      selectedScanners.map((source) => source.toLowerCase())
    );

    return findings.filter((finding) => {
      const severity = (finding.severity || "LOW") as Severity;
      if (!selectedSeverities[severity]) {
        return false;
      }

      const fileType = getFileExtension(getPrimaryPath(finding));
      if (selectedFileTypes.length > 0 && !selectedFileTypes.includes(fileType)) {
        return false;
      }

      const sources = getScannerSources(finding);
      if (
        selectedScanners.length > 0 &&
        !sources.some((source) => selectedScannerSet.has(source))
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        finding.file_path,
        finding.secret_type,
        ...(finding.occurrences || []).map(
          (occurrence) => `${occurrence.file_path}:${occurrence.line_number}`
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    findings,
    findingSearch,
    selectedSeverities,
    selectedFileTypes,
    selectedScanners,
  ]);

  const sortedFindings = useMemo(() => {
    const sorted = [...filteredFindings];
    sorted.sort((a, b) => {
      const severityDiff = severityRank(b.severity) - severityRank(a.severity);
      const countDiff = getOccurrenceCount(b) - getOccurrenceCount(a);
      const fileA = getPrimaryPath(a);
      const fileB = getPrimaryPath(b);

      switch (sortOption) {
        case "count-desc":
          return countDiff || severityDiff || fileA.localeCompare(fileB);
        case "file-asc":
          return fileA.localeCompare(fileB);
        case "file-desc":
          return fileB.localeCompare(fileA);
        case "risk-desc":
        default:
          return severityDiff || countDiff || fileA.localeCompare(fileB);
      }
    });
    return sorted;
  }, [filteredFindings, sortOption]);

  const visibleFindings = useMemo(
    () => sortedFindings.slice(0, visibleCount),
    [sortedFindings, visibleCount]
  );

  const hasMoreFindings = visibleCount < sortedFindings.length;
  const visibleStart = visibleFindings.length > 0 ? 1 : 0;
  const visibleEnd = visibleFindings.length;
  const filteredNoiseCount =
    scanResult?.heuristics_stats?.false_positives_filtered ??
    findings.filter((finding) => finding.is_noise).length;

  const loadMoreFindings = useCallback(() => {
    if (!hasMoreFindings || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + FINDINGS_BATCH_SIZE, sortedFindings.length));
      setIsLoadingMore(false);
    }, 280);
  }, [hasMoreFindings, isLoadingMore, sortedFindings.length]);

  useEffect(() => {
    setVisibleCount(Math.min(FINDINGS_BATCH_SIZE, sortedFindings.length));
    setIsLoadingMore(false);
  }, [sortedFindings.length]);

  useEffect(() => {
    if (!loadMoreSentinelRef.current || !hasMoreFindings) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreFindings();
        }
      },
      { rootMargin: "280px 0px" }
    );

    observer.observe(loadMoreSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreFindings, loadMoreFindings]);

  const headerSubtitle = useMemo(() => {
    if (error) return error;
    if (scanResult) {
      if (totalFindings > 0) {
        return `Found ${totalFindings} potential secret(s) in ${scanResult.files_affected} file(s).`;
      }
      return "No secrets found. Your code looks secure.";
    }
    if (scanMode === "upload") {
      return "Upload a ZIP file to scan for leaked secrets locally. No data stored.";
    }
    return "Scan public GitHub, GitLab, or Bitbucket repositories for leaked secrets. Read-only. No data stored.";
  }, [error, scanResult, totalFindings, scanMode]);

  const scanStatusMeta = useMemo(() => {
    if (loading) {
      return {
        tone: "border-orange-800 bg-orange-950/30 text-orange-200",
        title: "Scan in progress",
        message:
          progress || "Analyzing source files and checking for leaked secrets.",
      };
    }

    if (error) {
      return {
        tone: "border-red-800 bg-red-950/30 text-red-200",
        title: "Scan needs attention",
        message: error,
      };
    }

    if (!scanResult) {
      return {
        tone: "border-zinc-800 bg-zinc-900/50 text-zinc-300",
        title: scanMode === "upload" ? "Ready for ZIP scan" : "Ready for repository scan",
        message:
          scanMode === "upload"
            ? "Upload a ZIP file and start scanning. Files are analyzed temporarily and not stored."
            : "Paste a public GitHub, GitLab, or Bitbucket repository URL and start scanning. The scan is read-only and temporary.",
      };
    }

    if (totalFindings === 0) {
      return {
        tone: "border-emerald-800 bg-emerald-950/30 text-emerald-200",
        title: "Scan completed successfully",
        message:
          "No leaked secrets were detected. Continue using environment variables and secret managers.",
      };
    }

    if (scanResult.has_critical || scanResult.has_high) {
      return {
        tone: "border-red-800 bg-red-950/30 text-red-200",
        title: "High-risk findings detected",
        message:
          "Prioritize critical and high findings first, rotate exposed credentials, then apply remediation.",
      };
    }

    return {
      tone: "border-orange-800 bg-orange-950/30 text-orange-200",
      title: "Moderate findings detected",
      message:
        "Review and resolve findings to reduce security risk and prevent future leakage.",
    };
  }, [loading, error, scanResult, scanMode, totalFindings, progress]);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    } catch {
      // ignore silently
    }
  };

  const toggleRevealSecret = (key: string) => {
    if (revealedSecrets.has(key)) {
      setRevealedSecrets((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }

    const approved = window.confirm(
      "Reveal this secret? Only do this on a secure device and avoid screen sharing."
    );
    if (!approved) {
      return;
    }

    setRevealedSecrets((prev) => new Set(prev).add(key));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]?.name.toLowerCase().endsWith(".zip")) {
      setUploadedFile(e.dataTransfer.files[0]);
      setError("");
    } else {
      setError("Please upload a ZIP file");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]?.name.toLowerCase().endsWith(".zip")) {
      setUploadedFile(e.target.files[0]);
      setError("");
    } else {
      setError("Please upload a ZIP file");
    }
  };

  const resetFindingControls = () => {
    setFindingSearch("");
    setSelectedSeverities({ ...DEFAULT_SEVERITY_SELECTION });
    setSelectedFileTypes([]);
    setSelectedScanners([]);
    setSortOption("risk-desc");
    setVisibleCount(FINDINGS_BATCH_SIZE);
  };

  const toggleSeverity = (severity: Severity) => {
    setSelectedSeverities((prev) => ({
      ...prev,
      [severity]: !prev[severity],
    }));
  };

  const toggleFileType = (fileType: string) => {
    setSelectedFileTypes((prev) =>
      prev.includes(fileType)
        ? prev.filter((value) => value !== fileType)
        : [...prev, fileType]
    );
  };

  const toggleScannerSource = (source: string) => {
    setSelectedScanners((prev) =>
      prev.includes(source)
        ? prev.filter((value) => value !== source)
        : [...prev, source]
    );
  };

  const handleUploadScanClick = () => {
    if (!uploadedFile) {
      setError("Please select a ZIP file to scan");
      return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError("Frontend API URL is not configured. Set NEXT_PUBLIC_API_URL.");
      return;
    }
    setActionStatus(null);
    resetFindingControls();
    runUploadScan(uploadedFile, apiUrl);
  };

  const handleUrlScanClick = () => {
    cancelScan();
    setActionStatus(null);
    if (!isSupportedRepoUrl(repoUrl)) {
      setError(
        "Please enter a valid repository URL (e.g., https://github.com/owner/repo, https://gitlab.com/group/project, or https://bitbucket.org/workspace/repo)"
      );
      return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError("Frontend API URL is not configured. Set NEXT_PUBLIC_API_URL.");
      return;
    }
    resetFindingControls();
    runUrlScan(repoUrl.trim(), apiUrl);
  };

  const buildExportPayload = () => {
    if (!scanResult) {
      return null;
    }

    const source = scanResult.source || (scanMode === "upload" ? "upload" : "repository_url");
    const target =
      scanResult.scan_target ||
      (source === "upload"
        ? scanResult.filename || uploadedFile?.name || "Uploaded ZIP file"
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/export/json`, {
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
      setCopiedKey("summary");
      setTimeout(() => setCopiedKey(null), 2000);
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/export/log`, {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/export/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            await response.json().catch(() => ({})),
            "Failed to copy scan log"
          )
        );
      }

      await navigator.clipboard.writeText(await response.text());
      setCopiedKey("log");
      setTimeout(() => setCopiedKey(null), 2000);
      setActionStatus({ type: "success", message: "Scan log copied to clipboard." });
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

  return (
    <main className="min-h-screen w-full flex flex-col bg-zinc-950 text-zinc-100">
      <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between border-b border-zinc-800 py-3 sm:py-4">
            <Link
              href="/"
              className="flex items-center gap-3 sm:gap-4 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-md border border-emerald-800 bg-emerald-950/40">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-black tracking-tight text-zinc-100">
                  Secret Guardian
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400">
                  AI-Powered Secret Detection & Remediation
                </p>
              </div>
            </Link>

            <div className="hidden lg:flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-[11px] font-mono uppercase text-emerald-300">
                  Read-Only
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-800 bg-emerald-950/30 px-3 py-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-[11px] font-mono uppercase text-emerald-300">
                  No Data Stored
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-orange-800 bg-orange-950/30 px-3 py-1.5">
                <Zap className="h-3.5 w-3.5 text-orange-300" />
                <span className="text-[11px] font-mono uppercase text-orange-300">
                  AI-Powered
                </span>
              </div>
            </div>
          </div>

          <div className="py-4 sm:py-6">
            <div className="mb-4 flex max-w-sm rounded-md border border-zinc-800 bg-zinc-900 p-1">
              <button
                onClick={() => {
                  cancelScan();
                  setScanMode("url");
                  setError("");
                  setActionStatus(null);
                }}
                className={`focus-ring flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${scanMode === "url" ? "border border-zinc-700 bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"}`}
                aria-label="Switch to repository URL scan"
              >
                <Github className="h-4 w-4" />
                <span>Repository URL</span>
              </button>
              <button
                onClick={() => {
                  cancelScan();
                  setScanMode("upload");
                  setError("");
                  setActionStatus(null);
                }}
                className={`focus-ring flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${scanMode === "upload" ? "border border-zinc-700 bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"}`}
                aria-label="Switch to ZIP upload scan"
              >
                <Upload className="h-4 w-4" />
                <span>Upload ZIP</span>
              </button>
            </div>

            {scanMode === "url" && (
              <>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Github className="h-5 w-5 text-zinc-500" />
                    </div>
                    <Input
                      type="url"
                      placeholder="https://github.com/owner/repo (or gitlab.com / bitbucket.org)"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className="h-12 rounded-md border-zinc-800 pl-12 text-base font-mono focus:border-orange-500 focus:ring-orange-500 sm:h-14"
                      disabled={loading}
                      onKeyDown={(e) =>
                        e.key === "Enter" && !loading && handleUrlScanClick()
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleUrlScanClick}
                    disabled={loading}
                    className="h-12 rounded-md border border-zinc-700 bg-zinc-900 px-8 font-mono text-xs tracking-wide hover:border-orange-500 hover:bg-zinc-800 sm:h-14"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Scanning...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        <span>Scan Repository</span>
                      </span>
                    )}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                  <span>Try a sample:</span>
                  <button
                    className="focus-ring font-mono font-medium text-orange-300 underline decoration-zinc-600 underline-offset-2 transition-colors hover:text-orange-200 hover:decoration-orange-400"
                    onClick={() =>
                      setRepoUrl(
                        "https://github.com/shriyamchandra/Book-Store-Management-Capstone-Project"
                      )
                    }
                  >
                    Book-Store-Management
                  </button>
                </div>
              </>
            )}

            {scanMode === "upload" && (
              <>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative rounded-md border-2 border-dashed p-8 text-center transition-colors ${dragActive ? "border-orange-500 bg-orange-950/25" : uploadedFile ? "border-emerald-700 bg-emerald-950/20" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}
                >
                  {uploadedFile ? (
                    <div className="flex flex-col items-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-md border border-emerald-800 bg-emerald-950/50">
                        <FolderArchive className="h-7 w-7 text-emerald-300" />
                      </div>
                      <p className="mb-1 text-sm font-mono text-zinc-100">
                        {uploadedFile.name}
                      </p>
                      <p className="mb-3 text-xs font-mono text-zinc-500">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        onClick={() => setUploadedFile(null)}
                        className="focus-ring inline-flex items-center gap-1 text-sm text-red-300 transition-colors hover:text-red-200"
                      >
                        <X className="h-4 w-4" /> Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                        <Upload className="h-7 w-7 text-zinc-500" />
                      </div>
                      <p className="mb-1 text-sm font-medium text-zinc-100">
                        Drag and drop your ZIP file here
                      </p>
                      <p className="mb-3 text-xs text-zinc-500">or click to browse</p>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-mono text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800">
                        <FolderArchive className="h-4 w-4" /> Browse Files
                        <input
                          type="file"
                          accept=".zip"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={handleUploadScanClick}
                    disabled={loading || !uploadedFile}
                    className="h-12 w-full rounded-md border border-zinc-700 bg-zinc-900 px-8 font-mono text-xs tracking-wide hover:border-orange-500 hover:bg-zinc-800 sm:h-14 sm:w-auto"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Scanning...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        <span>Scan ZIP File</span>
                      </span>
                    )}
                  </Button>
                </div>
              </>
            )}

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
              <ActionStatusBanner
                status={actionStatus}
                onDismiss={() => setActionStatus(null)}
              />
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
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          {!loading && !scanResult && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/60">
                <ShieldCheck className="h-10 w-10 text-zinc-500" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-100">
                Ready to Scan
              </h3>
              <p className="mb-6 max-w-md text-zinc-400">
                Enter a public repository URL (GitHub, GitLab, or Bitbucket) above and start scanning to
                detect leaked secrets.
              </p>

              <div className="grid sm:grid-cols-3 gap-4 max-w-2xl w-full">
                <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-orange-300 transition-transform duration-200 group-hover:scale-105" />
                    <span className="text-sm font-semibold text-zinc-100">
                      Secrets Masked
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    All detected secrets are masked by default for safety.
                  </p>
                </div>
                <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-300 transition-transform duration-200 group-hover:scale-105" />
                    <span className="text-sm font-semibold text-zinc-100">
                      No Storage
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Temporary scan only. No data is stored after analysis.
                  </p>
                </div>
                <div className="group interactive-card rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-orange-300 transition-transform duration-200 group-hover:scale-105" />
                    <span className="text-sm font-semibold text-zinc-100">
                      AI Remediation
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Get AI-powered fix suggestions for each finding.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="mb-6 flex items-center gap-3 rounded-md border border-red-800 bg-red-950/40 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-red-800 bg-red-950/60">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-200">Scan Failed</div>
                <div className="text-sm text-red-300">{error}</div>
              </div>
            </div>
          )}

          {scanResult && (
            <div className="mb-6">
              <ScanSummaryCards scanResult={scanResult} />

              {scanResult.findings_truncated && (
                <div className="mb-6 rounded-md border border-orange-800 bg-orange-950/30 p-4 text-sm text-orange-200">
                  Large scan detected. Showing first{" "}
                  <strong>{scanResult.displayed_findings ?? displayedFindings}</strong>{" "}
                  of <strong>{totalFindings}</strong> findings for browser stability.
                </div>
              )}

              {scanResult.ai_stats && (
                <div className="panel-surface mb-6 p-4 text-sm text-zinc-300">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <span>
                      AI remediation generated for{" "}
                      <strong className="text-zinc-100">
                        {scanResult.ai_stats.ai_calls_made}
                      </strong>{" "}
                      findings, reused for{" "}
                      <strong className="text-zinc-100">
                        {scanResult.ai_stats.ai_calls_deduped}
                      </strong>
                      , and skipped for{" "}
                      <strong className="text-zinc-100">
                        {scanResult.ai_stats.ai_calls_skipped}
                      </strong>
                      .
                    </span>
                    <span className="font-mono text-xs text-zinc-500">
                      AI budget: {scanResult.ai_stats.ai_calls_made}/
                      {scanResult.ai_stats.budget_limit}
                    </span>
                  </div>
                  {scanResult.ai_stats.circuit_broken && (
                    <p className="mt-2 text-xs text-orange-300">
                      AI rate-limit protection activated; fallback remediation may
                      be shown for some findings.
                    </p>
                  )}
                </div>
              )}

              {scanResult && (
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button
                    variant="outline"
                    onClick={exportLog}
                    className="w-full gap-2 sm:w-auto"
                  >
                    <FileText className="h-4 w-4" /> Download Log
                  </Button>
                  <Button
                    variant="outline"
                    onClick={copyLog}
                    className="w-full gap-2 sm:w-auto"
                  >
                    {copiedKey === "log" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Clipboard className="h-4 w-4" /> Copy Log
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={exportJSON}
                    className="w-full gap-2 sm:w-auto"
                  >
                    <FileJson className="h-4 w-4" /> Export JSON
                  </Button>
                  <Button
                    variant="outline"
                    onClick={copySummary}
                    className="w-full gap-2 sm:w-auto"
                  >
                    {copiedKey === "summary" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Clipboard className="h-4 w-4" /> Copy Summary
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {totalFindings > 0 && (
            <div className="space-y-4">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-bold text-zinc-100">
                  Master Incidents
                </h2>
                <div className="text-sm font-mono text-zinc-500">
                  {totalFindings} total incidents • {sortedFindings.length} after active filters
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-12">
                <aside className="panel-surface h-fit p-4 lg:sticky lg:top-4 lg:col-span-3">
                  <div className="space-y-5">
                    <div>
                      <label
                        htmlFor="findings-search"
                        className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                      >
                        Search
                      </label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <Input
                          id="findings-search"
                          placeholder="Search file path or secret type"
                          value={findingSearch}
                          onChange={(event) => setFindingSearch(event.target.value)}
                          className="h-10 pl-10 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Severity
                      </h3>
                      <div className="space-y-2">
                        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severity[]).map(
                          (severity) => (
                            <label
                              key={severity}
                              className="flex items-center gap-2 text-sm text-zinc-300"
                            >
                              <input
                                type="checkbox"
                                checked={selectedSeverities[severity]}
                                onChange={() => toggleSeverity(severity)}
                                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-orange-500 focus:ring-orange-500"
                              />
                              <span className="flex-1">{severity}</span>
                              <span className="font-mono text-xs text-zinc-500">
                                {severityCounts[severity]}
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        File Type
                      </h3>
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                        {fileTypeOptions.map((fileType) => (
                          <label
                            key={fileType}
                            className="flex items-center gap-2 text-sm text-zinc-300"
                          >
                            <input
                              type="checkbox"
                              checked={selectedFileTypes.includes(fileType)}
                              onChange={() => toggleFileType(fileType)}
                              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-orange-500 focus:ring-orange-500"
                            />
                            <span className="font-mono text-xs">{fileType}</span>
                          </label>
                        ))}
                        {fileTypeOptions.length === 0 && (
                          <p className="text-xs text-zinc-500">No file type data available.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Scanner Source
                      </h3>
                      <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                        {scannerOptions.map((source) => (
                          <label
                            key={source}
                            className="flex items-center gap-2 text-sm text-zinc-300"
                          >
                            <input
                              type="checkbox"
                              checked={selectedScanners.includes(source)}
                              onChange={() => toggleScannerSource(source)}
                              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-orange-500 focus:ring-orange-500"
                            />
                            <span className="font-mono text-xs uppercase">{source}</span>
                          </label>
                        ))}
                        {scannerOptions.length === 0 && (
                          <p className="text-xs text-zinc-500">No scanner source data available.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="sort-option"
                        className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                      >
                        Sort By
                      </label>
                      <div className="relative">
                        <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <select
                          id="sort-option"
                          value={sortOption}
                          onChange={(event) =>
                            setSortOption(event.target.value as SortOption)
                          }
                          className="focus-ring h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 pl-10 text-sm text-zinc-100"
                        >
                          <option value="risk-desc">Highest Risk</option>
                          <option value="count-desc">Most Locations</option>
                          <option value="file-asc">File A-Z</option>
                          <option value="file-desc">File Z-A</option>
                        </select>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={resetFindingControls}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </aside>

                <section className="space-y-4 lg:col-span-9">
                  <div className="sticky top-3 z-10 rounded-md border border-zinc-800 bg-zinc-900/95 px-4 py-3 backdrop-blur-sm">
                    <p className="text-sm font-medium text-zinc-200">
                      Showing {visibleStart}-{visibleEnd} of {sortedFindings.length} findings (Filtered {filteredNoiseCount} items as noise).
                    </p>
                  </div>

                  {sortedFindings.length === 0 ? (
                    <div className="panel-surface p-5 text-sm text-zinc-300">
                      No findings match your current filters.
                    </div>
                  ) : (
                    <>
                      {visibleFindings.map((finding) => {
                        const findingKey = getStableFindingKey(finding);

                        return (
                          <VulnerabilityCard
                            key={findingKey}
                            finding={finding}
                            findingKey={findingKey}
                            isRevealed={revealedSecrets.has(findingKey)}
                            copiedKey={copiedKey}
                            toggleRevealSecret={toggleRevealSecret}
                            copyText={copyText}
                          />
                        );
                      })}

                      {isLoadingMore &&
                        Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={`findings-skeleton-${index}`}
                            className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/40 animate-pulse"
                          >
                            <div className="h-12 border-b border-zinc-800 bg-zinc-800/40" />
                            <div className="space-y-3 p-5">
                              <div className="h-4 w-1/3 rounded bg-zinc-800/60" />
                              <div className="h-14 rounded bg-zinc-800/45" />
                              <div className="h-20 rounded bg-zinc-800/35" />
                            </div>
                          </div>
                        ))}

                      <div ref={loadMoreSentinelRef} className="h-4" />

                      <div className="panel-surface mt-2 flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
                        <div className="text-sm text-zinc-300">
                          Loaded <strong>{visibleFindings.length}</strong> of <strong>{sortedFindings.length}</strong> findings
                        </div>
                        <div className="flex w-full gap-2 sm:w-auto">
                          {hasMoreFindings ? (
                            <Button
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={loadMoreFindings}
                              disabled={isLoadingMore}
                            >
                              {isLoadingMore ? "Loading..." : "Load More"}
                            </Button>
                          ) : (
                            <span className="rounded-md border border-emerald-800 bg-emerald-950/35 px-3 py-2 text-xs font-medium text-emerald-300">
                              All filtered findings loaded
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
