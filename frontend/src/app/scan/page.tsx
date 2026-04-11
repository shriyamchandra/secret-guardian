"use client";

import { useEffect, useMemo, useState } from "react";
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
  isGithubUrl,
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
const FINDINGS_PER_PAGE = 10;

type SeverityFilter = "ALL" | Severity;
type SortOption = "risk-desc" | "count-desc" | "file-asc" | "file-desc";

const getOccurrenceCount = (finding: Finding) =>
  finding.occurrence_count ?? finding.occurrences?.length ?? 1;

const getPrimaryPath = (finding: Finding) =>
  finding.occurrences?.[0]?.file_path || finding.file_path || "";

export default function ScanPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [scanMode, setScanMode] = useState<"url" | "upload">("url");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [findingSearch, setFindingSearch] = useState("");
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("ALL");
  const [sortOption, setSortOption] = useState<SortOption>("risk-desc");
  const [currentPage, setCurrentPage] = useState(1);

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

  const filteredFindings = useMemo(() => {
    const query = findingSearch.trim().toLowerCase();

    return findings.filter((finding) => {
      if (severityFilter !== "ALL" && finding.severity !== severityFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        finding.file_path,
        finding.secret_type,
        finding.leaked_line,
        finding.code_snippet,
        finding.raw_value,
        ...(finding.occurrences || []).map(
          (occurrence) => `${occurrence.file_path}:${occurrence.line_number}`
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [findings, findingSearch, severityFilter]);

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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedFindings.length / FINDINGS_PER_PAGE)),
    [sortedFindings.length]
  );

  const paginatedFindings = useMemo(() => {
    const start = (currentPage - 1) * FINDINGS_PER_PAGE;
    return sortedFindings.slice(start, start + FINDINGS_PER_PAGE);
  }, [sortedFindings, currentPage]);


  useEffect(() => {
    setCurrentPage(1);
  }, [findingSearch, severityFilter, sortOption, totalFindings]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

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
    return "Scan any public GitHub repository for leaked secrets. Read-only. No data stored.";
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
            : "Paste a public GitHub repository URL and start scanning. The scan is read-only and temporary.",
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
    setSeverityFilter("ALL");
    setSortOption("risk-desc");
    setCurrentPage(1);
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
    if (!isGithubUrl(repoUrl)) {
      setError(
        "Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)"
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

  const exportJSON = async () => {
    if (!scanResult) return;
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
        body: JSON.stringify({
          findings,
          repo_url: repoUrl,
          scan_duration: scanResult.scan_duration,
          severity_breakdown: scanResult.severity_breakdown,
        }),
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
          body: JSON.stringify({
            findings,
            repo_url: repoUrl,
            scan_duration: scanResult.scan_duration,
            severity_breakdown: scanResult.severity_breakdown,
          }),
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
                aria-label="Switch to GitHub repository scan"
              >
                <Github className="h-4 w-4" />
                <span>GitHub URL</span>
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
                      placeholder="https://github.com/username/repository"
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
                Enter a public GitHub repository URL above and start scanning to
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

              {totalFindings > 0 && (
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                  Showing {paginatedFindings.length} of {sortedFindings.length} filtered incidents •{" "}
                  {totalFindings} total master incidents
                </div>
              </div>

              <div className="panel-surface p-4">
                <div className="grid gap-3 md:grid-cols-12">
                  <div className="md:col-span-6">
                    <label
                      htmlFor="findings-search"
                      className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Search Findings
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="findings-search"
                        placeholder="Filter by secret type, leaked value, or location"
                        value={findingSearch}
                        onChange={(event) => setFindingSearch(event.target.value)}
                        className="h-10 pl-10 text-sm"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="severity-filter"
                      className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Severity
                    </label>
                    <select
                      id="severity-filter"
                      value={severityFilter}
                      onChange={(event) =>
                        setSeverityFilter(event.target.value as SeverityFilter)
                      }
                      className="focus-ring h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                    >
                      <option value="ALL">All</option>
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
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

                  <div className="flex items-end md:col-span-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={resetFindingControls}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className={`focus-ring rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${severityFilter === "ALL" ? "border-zinc-600 bg-zinc-800 text-zinc-100" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"}`}
                    onClick={() => setSeverityFilter("ALL")}
                  >
                    All ({totalFindings})
                  </button>
                  <button
                    className={`focus-ring rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${severityFilter === "CRITICAL" ? "border-red-700 bg-red-950/60 text-red-200" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"}`}
                    onClick={() => setSeverityFilter("CRITICAL")}
                  >
                    Critical ({severityCounts.CRITICAL})
                  </button>
                  <button
                    className={`focus-ring rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${severityFilter === "HIGH" ? "border-red-800 bg-red-950/50 text-red-300" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"}`}
                    onClick={() => setSeverityFilter("HIGH")}
                  >
                    High ({severityCounts.HIGH})
                  </button>
                  <button
                    className={`focus-ring rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${severityFilter === "MEDIUM" ? "border-orange-700 bg-orange-950/50 text-orange-200" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"}`}
                    onClick={() => setSeverityFilter("MEDIUM")}
                  >
                    Medium ({severityCounts.MEDIUM})
                  </button>
                  <button
                    className={`focus-ring rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${severityFilter === "LOW" ? "border-orange-800 bg-orange-950/40 text-orange-300" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"}`}
                    onClick={() => setSeverityFilter("LOW")}
                  >
                    Low ({severityCounts.LOW})
                  </button>
                </div>
              </div>

              {sortedFindings.length === 0 ? (
                <div className="panel-surface p-5 text-sm text-zinc-300">
                  No findings match your current filters.
                </div>
              ) : (
                <>
                  {paginatedFindings.map((finding, index) => {
                    const findingKey = [
                      finding.raw_value || "",
                      finding.secret_type || "",
                      finding.file_path || "",
                      String(finding.line_number || 0),
                      String(index),
                    ].join("|");

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

                  {totalPages > 1 && (
                    <div className="panel-surface mt-2 flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
                      <div className="text-sm text-zinc-300">
                        Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                      </div>
                      <div className="flex w-full gap-2 sm:w-auto">
                        <Button
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          onClick={() =>
                            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                          }
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
