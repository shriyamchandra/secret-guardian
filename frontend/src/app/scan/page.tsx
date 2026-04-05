"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AIResponseMarkdown } from "@/components/AIResponseMarkdown";
import {
  ActionStatusBanner,
  type ActionStatus,
} from "@/components/scan/ActionStatusBanner";
import {
  ShieldCheck,
  Loader2,
  Github,
  FileText,
  ChevronDown,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Search,
  Lock,
  Zap,
  Shield,
  AlertCircle,
  FileJson,
  Clock,
  Eye,
  EyeOff,
  AlertOctagon,
  Info,
  HelpCircle,
  Clipboard,
  Upload,
  FolderArchive,
  X,
} from "lucide-react";

// Types
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type Exploitability = "EXPLOITABLE_NOW" | "BAD_PRACTICE" | "LIKELY_FALSE_POSITIVE";
type RecommendedAction = "ROTATE_NOW" | "FIX_WHEN_POSSIBLE" | "REVIEW" | "IGNORE";

type ThreatContext = {
  risk_level: Severity | "INFO";
  exploitability: Exploitability;
  context_notes: string[];
  confidence: number;
  recommended_action: RecommendedAction;
  risk_factors: string[];
  mitigating_factors: string[];
};

type Finding = {
  file_path: string;
  line_number: number;
  secret_type: string;
  leaked_line: string;
  language?: string;
  code_snippet?: string;
  confidence?: string;
  confidence_score?: number;
  entropy?: number;
  severity?: Severity;
  raw_value?: string;
  scanner_source?: string;
  threat_context?: ThreatContext;
  ai_fix?: {
    suggestion?: string;
    error?: string;
    threat_context?: ThreatContext;
    ai_generated?: boolean;
    ai_status?: string;
  };
};

type ScanResult = {
  findings: Finding[];
  total_findings: number;
  files_affected: number;
  severity_breakdown: Record<Severity, number>;
  scan_duration: number;
  scanners_used: string[];
  has_critical: boolean;
  has_high: boolean;
  ai_stats?: {
    ai_calls_made: number;
    ai_calls_skipped: number;
    ai_calls_deduped: number;
    budget_limit: number;
    circuit_broken: boolean;
  };
};

const EMPTY_SEVERITY_BREAKDOWN: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 0,
  MEDIUM: 0,
  LOW: 0,
};

const parseTimeoutMs = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SCAN_REQUEST_TIMEOUT_MS = parseTimeoutMs(
  process.env.NEXT_PUBLIC_SCAN_TIMEOUT_MS,
  300_000
);
const EXPORT_REQUEST_TIMEOUT_MS = parseTimeoutMs(
  process.env.NEXT_PUBLIC_EXPORT_TIMEOUT_MS,
  30_000
);

// Utility functions
const isGithubUrl = (url: string) =>
  /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\.git)?\/?$/i.test(url.trim());

const isAbortError = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";

const getErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const detail = record.detail ?? record.message ?? record.error;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") {
      const nested = detail as Record<string, unknown>;
      if (typeof nested.message === "string") return nested.message;
      if (typeof nested.error === "string") return nested.error;
    }
  }

  return fallback;
};

const parseEventPayload = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const maskSecret = (value: string, revealed: boolean = false): string => {
  if (!value) return "";
  if (revealed) return value;
  return "••••••••••••";
};

const getSeverityColor = (severity?: Severity) => {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-600 text-white";
    case "HIGH":
      return "bg-red-500 text-white";
    case "MEDIUM":
      return "bg-yellow-500 text-white";
    case "LOW":
      return "bg-blue-500 text-white";
    default:
      return "bg-slate-500 text-white";
  }
};

const getSeverityIcon = (severity?: Severity) => {
  switch (severity) {
    case "CRITICAL":
      return <AlertOctagon className="h-3 w-3" />;
    case "HIGH":
      return <AlertTriangle className="h-3 w-3" />;
    case "MEDIUM":
      return <AlertCircle className="h-3 w-3" />;
    default:
      return <Info className="h-3 w-3" />;
  }
};

// Threat Context Display Helpers
const getExploitabilityColor = (exploitability?: Exploitability) => {
  switch (exploitability) {
    case "EXPLOITABLE_NOW":
      return "bg-red-100 text-red-800 border-red-200";
    case "BAD_PRACTICE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "LIKELY_FALSE_POSITIVE":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
};

const getExploitabilityLabel = (exploitability?: Exploitability) => {
  switch (exploitability) {
    case "EXPLOITABLE_NOW":
      return "🚨 Exploitable Now";
    case "BAD_PRACTICE":
      return "⚡ Bad Practice";
    case "LIKELY_FALSE_POSITIVE":
      return "✅ Likely Safe";
    default:
      return "Unknown";
  }
};

const getActionLabel = (action?: RecommendedAction) => {
  switch (action) {
    case "ROTATE_NOW":
      return "Rotate Immediately";
    case "FIX_WHEN_POSSIBLE":
      return "Fix When Possible";
    case "REVIEW":
      return "Review & Verify";
    case "IGNORE":
      return "Can Ignore";
    default:
      return "Unknown";
  }
};

// Threat Context Badge Component
const ThreatContextBadge = ({ context }: { context?: ThreatContext }) => {
  if (!context) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${getExploitabilityColor(context.exploitability)}`}>
      <span>{getExploitabilityLabel(context.exploitability)}</span>
    </div>
  );
};

// Threat Context Details Component
const ThreatContextDetails = ({ context }: { context?: ThreatContext }) => {
  const [expanded, setExpanded] = useState(false);

  if (!context) return null;

  return (
    <div className="mt-3 border-t border-slate-700 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
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
              <div key={i} className="text-slate-300 text-xs">
                {note}
              </div>
            ))}
          </div>

          {/* Risk Assessment Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-400 mb-1">Risk Level</div>
              <div className="font-medium text-white">{context.risk_level}</div>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-400 mb-1">Recommended Action</div>
              <div className="font-medium text-white">{getActionLabel(context.recommended_action)}</div>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-400 mb-1">Confidence</div>
              <div className="font-medium text-white">{Math.round(context.confidence * 100)}%</div>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-400 mb-1">Assessment</div>
              <div className="font-medium text-white">{context.exploitability.replace(/_/g, ' ')}</div>
            </div>
          </div>

          {/* Risk Factors */}
          {context.risk_factors.length > 0 && (
            <div>
              <div className="text-red-400 text-xs font-medium mb-1">⚠️ Risk Factors</div>
              <ul className="text-xs text-slate-400 space-y-0.5 ml-4 list-disc">
                {context.risk_factors.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {/* Mitigating Factors */}
          {context.mitigating_factors.length > 0 && (
            <div>
              <div className="text-green-400 text-xs font-medium mb-1">✓ Mitigating Factors</div>
              <ul className="text-xs text-slate-400 space-y-0.5 ml-4 list-disc">
                {context.mitigating_factors.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Security Education Tooltips
const educationContent = {
  entropy: {
    title: "What is Entropy?",
    content:
      "Entropy measures randomness in a string. High entropy (4.0+) suggests a randomly generated secret, while low entropy indicates common words or patterns. Real secrets typically have high entropy.",
  },
  publicRepos: {
    title: "Why Public Repos are Risky",
    content:
      "Public repositories are indexed by search engines and bots. Exposed secrets can be found within minutes and exploited for unauthorized access, data theft, or financial fraud.",
  },
  masking: {
    title: "Why We Mask Secrets",
    content:
      "Secrets are masked by default to prevent accidental screen sharing exposure, shoulder surfing, and browser history/cache leakage. Only reveal when absolutely necessary.",
  },
  threatContext: {
    title: "Context-Aware Threat Analysis",
    content:
      "Not all secrets are equally dangerous. We analyze context like localhost references, test files, and placeholder values to distinguish between 'exploitable now' vs 'bad practice' vs 'likely false positive'.",
  },
};

// Tooltip Component
const EducationTooltip = ({ topic }: { topic: keyof typeof educationContent }) => {
  const [show, setShow] = useState(false);
  const info = educationContent[topic];

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-slate-400 hover:text-slate-600 transition-colors"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-sm rounded-lg shadow-xl">
          <div className="font-semibold mb-1">{info.title}</div>
          <div className="text-slate-300 text-xs leading-relaxed">{info.content}</div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-8 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};

export default function ScanPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [showRevealWarning, setShowRevealWarning] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<"url" | "upload">("url");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const scanAbortRef = useRef<AbortController | null>(null);
  const scanStreamRef = useRef<EventSource | null>(null);
  const streamFindingKeysRef = useRef<Set<string>>(new Set());

  const findings = useMemo(() => scanResult?.findings || [], [scanResult]);
  const totalFindings = findings.length;

  useEffect(() => {
    return () => {
      scanAbortRef.current?.abort();
      scanAbortRef.current = null;
      scanStreamRef.current?.close();
      scanStreamRef.current = null;
    };
  }, []);

  const startTimedRequest = (timeoutMs: number) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    return {
      controller,
      signal: controller.signal,
      cancel: () => {
        window.clearTimeout(timeoutId);
        controller.abort();
      },
      clear: () => {
        window.clearTimeout(timeoutId);
      },
    };
  };

  // Group findings by file
  const findingsByFile = useMemo(() => {
    const grouped: Record<string, Finding[]> = {};
    for (const f of findings) {
      if (!grouped[f.file_path]) grouped[f.file_path] = [];
      grouped[f.file_path].push(f);
    }
    return grouped;
  }, [findings]);

  const headerSubtitle = useMemo(() => {
    if (loading) return progress || "Scanning...";
    if (error) return error;
    if (scanResult) {
      if (totalFindings > 0) {
        return `Found ${totalFindings} potential secret(s) in ${scanResult.files_affected} file(s).`;
      }
      return "✅ No secrets found! Your code looks secure.";
    }
    if (scanMode === "upload") {
      return "Upload a ZIP file to scan for leaked secrets locally. No data stored.";
    }
    return "Scan any public GitHub repository for leaked secrets. Read-only. No data stored.";
  }, [loading, error, scanResult, totalFindings, progress, scanMode]);

  const applyAiFindingUpdate = (index: number, aiFix: Finding["ai_fix"]) => {
    if (!aiFix) return;
    setScanResult((prev) => {
      if (!prev || index < 0 || index >= prev.findings.length) return prev;
      const nextFindings = [...prev.findings];
      nextFindings[index] = {
        ...nextFindings[index],
        ai_fix: aiFix,
      };
      return {
        ...prev,
        findings: nextFindings,
      };
    });
  };

  const applyAiStatsUpdate = (aiStats: ScanResult["ai_stats"]) => {
    if (!aiStats) return;
    setScanResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ai_stats: aiStats,
      };
    });
  };

  const appendStreamFinding = (finding: Finding) => {
    const dedupeKey = `${finding.file_path}|${finding.line_number}|${finding.secret_type}`.toLowerCase();
    if (streamFindingKeysRef.current.has(dedupeKey)) {
      return;
    }
    streamFindingKeysRef.current.add(dedupeKey);

    setScanResult((prev) => {
      const nextFindings = prev ? [...prev.findings, finding] : [finding];
      const severityBreakdown: Record<Severity, number> = { ...EMPTY_SEVERITY_BREAKDOWN };
      for (const item of nextFindings) {
        const severity = item.severity;
        if (severity && severity in severityBreakdown) {
          severityBreakdown[severity] += 1;
        }
      }

      const filesAffected = new Set(nextFindings.map((f) => f.file_path)).size;
      const base: ScanResult = prev ?? {
        findings: [],
        total_findings: 0,
        files_affected: 0,
        severity_breakdown: { ...EMPTY_SEVERITY_BREAKDOWN },
        scan_duration: 0,
        scanners_used: [],
        has_critical: false,
        has_high: false,
      };

      return {
        ...base,
        findings: nextFindings,
        total_findings: nextFindings.length,
        files_affected: filesAffected,
        severity_breakdown: severityBreakdown,
        has_critical: severityBreakdown.CRITICAL > 0,
        has_high: severityBreakdown.HIGH > 0,
      };
    });
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    } catch {
      // ignore
    }
  };

  const toggleRevealSecret = (key: string) => {
    if (!revealedSecrets.has(key)) {
      setShowRevealWarning(key);
    } else {
      setRevealedSecrets((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const confirmReveal = () => {
    if (showRevealWarning) {
      setRevealedSecrets((prev) => new Set(prev).add(showRevealWarning));
      setShowRevealWarning(null);
    }
  };

  // File upload handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".zip")) {
        setUploadedFile(file);
        setError("");
      } else {
        setError("Please upload a ZIP file");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith(".zip")) {
        setUploadedFile(file);
        setError("");
      } else {
        setError("Please upload a ZIP file");
      }
    }
  };

  const handleUploadScan = async () => {
    if (!uploadedFile) {
      setError("Please select a ZIP file to scan");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError("Frontend API URL is not configured. Set NEXT_PUBLIC_API_URL.");
      return;
    }

    setError("");
    setActionStatus(null);
    setScanResult(null);
    streamFindingKeysRef.current = new Set();
    setLoading(true);
    setProgress("Uploading file...");
    scanStreamRef.current?.close();
    scanStreamRef.current = null;
    scanAbortRef.current?.abort();
    const request = startTimedRequest(SCAN_REQUEST_TIMEOUT_MS);
    scanAbortRef.current = request.controller;

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      setProgress("Connecting upload scan stream...");

      const response = await fetch(`${apiUrl}/scan/upload/stream`, {
        method: "POST",
        body: formData,
        signal: request.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(data, "Upload scan failed"));
      }
      if (!response.body) {
        throw new Error("Upload stream is unavailable. Please retry.");
      }

      setProgress("Streaming scan updates...");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamCompleted = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let splitIndex = buffer.indexOf("\n\n");
        while (splitIndex >= 0) {
          const rawEvent = buffer.slice(0, splitIndex);
          buffer = buffer.slice(splitIndex + 2);
          splitIndex = buffer.indexOf("\n\n");

          if (!rawEvent.trim()) {
            continue;
          }

          let eventName = "message";
          const dataParts: string[] = [];
          for (const rawLine of rawEvent.split(/\r?\n/)) {
            const line = rawLine.trimEnd();
            if (!line || line.startsWith(":")) continue;
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataParts.push(line.slice(5).trimStart());
            }
          }
          if (dataParts.length === 0) {
            continue;
          }

          const payload = parseEventPayload(dataParts.join("\n"));

          if (eventName === "progress") {
            const message = payload.message;
            if (typeof message === "string" && message) {
              setProgress(message);
            }
            continue;
          }

          if (eventName === "scan_result") {
            setScanResult(payload as unknown as ScanResult);
            continue;
          }

          if (eventName === "scan_finding") {
            const streamedFinding = payload.finding as Finding | undefined;
            if (streamedFinding && streamedFinding.file_path) {
              appendStreamFinding(streamedFinding);
            }
            continue;
          }

          if (eventName === "ai_finding") {
            const index = Number(payload.index);
            const aiFix = payload.ai_fix as Finding["ai_fix"] | undefined;
            if (Number.isInteger(index) && aiFix) {
              applyAiFindingUpdate(index, aiFix);
            }
            continue;
          }

          if (eventName === "ai_complete") {
            applyAiStatsUpdate(payload.ai_stats as ScanResult["ai_stats"]);
            continue;
          }

          if (eventName === "scan_error") {
            const message = payload.message;
            throw new Error(
              typeof message === "string" && message
                ? message
                : "Upload scan failed."
            );
          }

          if (eventName === "complete") {
            streamCompleted = true;
          }
        }
      }

      if (!streamCompleted) {
        throw new Error("Upload scan stream ended unexpectedly. Please retry.");
      }
    } catch (e: unknown) {
      const errorMessage = isAbortError(e)
        ? `Upload scan timed out after ${Math.ceil(SCAN_REQUEST_TIMEOUT_MS / 1000)}s. Please try a smaller ZIP or retry.`
        : e instanceof Error
          ? e.message
          : "Failed to scan. Please try again.";
      setError(errorMessage);
    } finally {
      request.clear();
      if (scanAbortRef.current === request.controller) {
        scanAbortRef.current = null;
      }
      setLoading(false);
      setProgress("");
    }
  };

  const handleScan = async () => {
    // Stop any previous in-flight scan stream before starting validation/new scan.
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    scanStreamRef.current?.close();
    scanStreamRef.current = null;

    setError("");
    setActionStatus(null);
    setScanResult(null);
    streamFindingKeysRef.current = new Set();
    setLoading(false);
    setProgress("");

    if (!isGithubUrl(repoUrl)) {
      setError("Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError("Frontend API URL is not configured. Set NEXT_PUBLIC_API_URL.");
      return;
    }

    setLoading(true);
    setProgress("Connecting to scan stream...");

    const streamUrl = `${apiUrl}/scan/stream?repo_url=${encodeURIComponent(repoUrl.trim())}`;
    const stream = new EventSource(streamUrl);
    scanStreamRef.current = stream;

    let completed = false;
    const isActiveStream = () => scanStreamRef.current === stream && !completed;
    const timeoutId = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      stream.close();
      if (scanStreamRef.current === stream) {
        scanStreamRef.current = null;
      }
      setError(
        `Scan timed out after ${Math.ceil(SCAN_REQUEST_TIMEOUT_MS / 1000)}s. Try a smaller repository or retry.`
      );
      setLoading(false);
      setProgress("");
    }, SCAN_REQUEST_TIMEOUT_MS);

    const finalizeStream = () => {
      if (completed) return;
      completed = true;
      window.clearTimeout(timeoutId);
      stream.close();
      if (scanStreamRef.current === stream) {
        scanStreamRef.current = null;
      }
      setLoading(false);
      setProgress("");
    };

    stream.addEventListener("progress", (event) => {
      if (!isActiveStream()) return;
      const payload = parseEventPayload((event as MessageEvent).data);
      const message = payload.message;
      if (typeof message === "string" && message) {
        setProgress(message);
      }
    });

    stream.addEventListener("scan_result", (event) => {
      if (!isActiveStream()) return;
      const payload = parseEventPayload((event as MessageEvent).data);
      setScanResult(payload as unknown as ScanResult);
    });

    stream.addEventListener("scan_finding", (event) => {
      if (!isActiveStream()) return;
      const payload = parseEventPayload((event as MessageEvent).data);
      const streamedFinding = payload.finding as Finding | undefined;
      if (streamedFinding && streamedFinding.file_path) {
        appendStreamFinding(streamedFinding);
      }
    });

    stream.addEventListener("ai_finding", (event) => {
      if (!isActiveStream()) return;
      const payload = parseEventPayload((event as MessageEvent).data);
      const index = Number(payload.index);
      const aiFix = payload.ai_fix as Finding["ai_fix"] | undefined;
      if (!Number.isInteger(index) || !aiFix) return;
      applyAiFindingUpdate(index, aiFix);
    });

    stream.addEventListener("ai_complete", (event) => {
      if (!isActiveStream()) return;
      const payload = parseEventPayload((event as MessageEvent).data);
      applyAiStatsUpdate(payload.ai_stats as ScanResult["ai_stats"]);
    });

    stream.addEventListener("scan_error", (event) => {
      if (!isActiveStream()) return;
      const payload = parseEventPayload((event as MessageEvent).data);
      const message = payload.message;
      setError(typeof message === "string" && message ? message : "Scan failed. Please try again.");
      finalizeStream();
    });

    stream.addEventListener("complete", () => {
      if (!isActiveStream()) return;
      finalizeStream();
    });

    stream.onerror = () => {
      if (!isActiveStream()) return;
      setError("Scan stream disconnected unexpectedly. Please retry.");
      finalizeStream();
    };
  };

  const exportJSON = async () => {
    if (!scanResult) return;
    setActionStatus(null);
    const request = startTimedRequest(EXPORT_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/export/json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findings: findings,
          repo_url: repoUrl,
          scan_duration: scanResult.scan_duration,
          severity_breakdown: scanResult.severity_breakdown,
        }),
        signal: request.signal,
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorPayload, "Failed to export JSON"));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secret-guardian-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionStatus({ type: "success", message: "JSON report exported successfully." });
    } catch (e: unknown) {
      const errorMessage = isAbortError(e)
        ? `Export timed out after ${Math.ceil(EXPORT_REQUEST_TIMEOUT_MS / 1000)}s.`
        : e instanceof Error
          ? e.message
          : "Failed to export JSON";
      setActionStatus({ type: "error", message: errorMessage });
    } finally {
      request.clear();
    }
  };

  const copySummary = async () => {
    if (!scanResult) return;
    setActionStatus(null);
    const request = startTimedRequest(EXPORT_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/export/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findings: findings,
          repo_url: repoUrl,
          scan_duration: scanResult.scan_duration,
          severity_breakdown: scanResult.severity_breakdown,
        }),
        signal: request.signal,
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorPayload, "Failed to copy summary"));
      }

      const data = await response.json();
      await navigator.clipboard.writeText(data.summary);
      setCopiedKey("summary");
      setTimeout(() => setCopiedKey(null), 2000);
      setActionStatus({ type: "success", message: "Summary copied to clipboard." });
    } catch (e: unknown) {
      const errorMessage = isAbortError(e)
        ? `Copy summary timed out after ${Math.ceil(EXPORT_REQUEST_TIMEOUT_MS / 1000)}s.`
        : e instanceof Error
          ? e.message
          : "Failed to copy summary";
      setActionStatus({ type: "error", message: errorMessage });
    } finally {
      request.clear();
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Reveal Warning Modal */}
      {showRevealWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reveal Secret?</h3>
                <p className="text-sm text-slate-500">This action may expose sensitive data</p>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Warning:</strong> Only reveal secrets on a secure device. Avoid screen sharing or public displays.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowRevealWarning(null)}>
                Cancel
              </Button>
              <Button onClick={confirmReveal} className="bg-yellow-500 hover:bg-yellow-600">
                Reveal Secret
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-lg">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Logo and Title */}
          <div className="flex items-center justify-between py-3 sm:py-4 border-b border-slate-100">
            <Link href="/" className="flex items-center gap-3 sm:gap-4 hover:opacity-80 transition-opacity cursor-pointer">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur-lg opacity-50"></div>
                <div className="relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900">
                  Secret Guardian
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                  AI-Powered Secret Detection & Remediation
                </p>
              </div>
            </Link>

            {/* Feature Pills */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs font-semibold text-green-900">Read-Only</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
                <Lock className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-blue-900">No Data Stored</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200">
                <Zap className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-xs font-semibold text-purple-900">AI-Powered</span>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="py-4 sm:py-6">
            {/* Mode Toggle */}
            <div className="flex mb-4 bg-slate-100 rounded-lg p-1 max-w-xs">
              <button
                onClick={() => {
                  scanStreamRef.current?.close();
                  scanStreamRef.current = null;
                  setLoading(false);
                  setProgress("");
                  setScanMode("url");
                  setError("");
                  setActionStatus(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${scanMode === "url"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Github className="h-4 w-4" />
                <span>GitHub URL</span>
              </button>
              <button
                onClick={() => {
                  scanStreamRef.current?.close();
                  scanStreamRef.current = null;
                  setLoading(false);
                  setProgress("");
                  setScanMode("upload");
                  setError("");
                  setActionStatus(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${scanMode === "upload"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Upload className="h-4 w-4" />
                <span>Upload ZIP</span>
              </button>
            </div>

            {/* GitHub URL Input */}
            {scanMode === "url" && (
              <>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Github className="h-5 w-5 text-slate-400" />
                    </div>
                    <Input
                      type="url"
                      placeholder="https://github.com/username/repository"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className="pl-12 h-12 sm:h-14 text-base border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 shadow-sm rounded-xl"
                      disabled={loading}
                      onKeyDown={(e) => e.key === "Enter" && !loading && handleScan()}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleScan}
                    disabled={loading}
                    className="h-12 sm:h-14 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl text-base font-semibold"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Scanning...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        <span>Scan Repository</span>
                      </span>
                    )}
                  </Button>
                </div>

                {/* Sample Repo Link */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span>Try a sample:</span>
                  <button
                    className="font-mono text-blue-600 hover:text-blue-700 underline decoration-dotted underline-offset-2 transition-colors font-medium"
                    onClick={() => setRepoUrl("https://github.com/shriyamchandra/Book-Store-Management-Capstone-Project")}
                  >
                    Book-Store-Management
                  </button>
                </div>
              </>
            )}

            {/* ZIP Upload */}
            {scanMode === "upload" && (
              <>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive
                    ? "border-blue-500 bg-blue-50"
                    : uploadedFile
                      ? "border-green-400 bg-green-50"
                      : "border-slate-300 bg-white hover:border-slate-400"
                    }`}
                >
                  {uploadedFile ? (
                    <div className="flex flex-col items-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-3">
                        <FolderArchive className="h-7 w-7 text-green-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 mb-1">{uploadedFile.name}</p>
                      <p className="text-xs text-slate-500 mb-3">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        onClick={() => setUploadedFile(null)}
                        className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-3">
                        <Upload className="h-7 w-7 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 mb-1">
                        Drag and drop your ZIP file here
                      </p>
                      <p className="text-xs text-slate-500 mb-3">or click to browse</p>
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">
                        <FolderArchive className="h-4 w-4" />
                        Browse Files
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

                {/* Scan Button for Upload */}
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={handleUploadScan}
                    disabled={loading || !uploadedFile}
                    className="w-full sm:w-auto h-12 sm:h-14 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl text-base font-semibold disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Scanning...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        <span>Scan ZIP File</span>
                      </span>
                    )}
                  </Button>
                </div>

                {/* Upload Info */}
                <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                  <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Upload Limits:</strong> Max 50MB ZIP file. Files are extracted temporarily and deleted after scanning. No data is stored.
                  </span>
                </div>
              </>
            )}

            {/* Disclaimer - URL mode only */}
            {scanMode === "url" && (
              <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Note:</strong> Only public repositories are supported. Scanning is read-only and temporary files are deleted after each scan. No repository content is stored.
                </span>
              </div>
            )}

            {/* Status Message */}
            <div className="mt-3 min-h-[1.5rem]">
              {!error && (
                <p
                  className={`text-sm font-medium leading-6 break-words transition-colors duration-200 ${error
                  ? "text-red-600"
                  : loading
                    ? "text-blue-600 animate-pulse"
                    : scanResult?.has_critical || scanResult?.has_high
                      ? "text-red-600"
                      : "text-slate-600"
                    }`}
                >
                  {headerSubtitle}
                </p>
              )}
              <ActionStatusBanner
                status={actionStatus}
                onDismiss={() => setActionStatus(null)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results Container */}
      <div className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          {/* Empty State */}
          {!loading && !scanResult && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200">
                <ShieldCheck className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Ready to Scan</h3>
              <p className="text-slate-600 max-w-md mb-6">
                Enter a public GitHub repository URL above and click &quot;Scan Repository&quot; to detect leaked secrets.
              </p>

              {/* Security Tips */}
              <div className="grid sm:grid-cols-3 gap-4 max-w-2xl w-full">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-900">Secrets Masked</span>
                  </div>
                  <p className="text-xs text-slate-500">All detected secrets are masked by default for safety.</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-slate-900">No Storage</span>
                  </div>
                  <p className="text-xs text-slate-500">Temporary scan only. No data is stored after analysis.</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-semibold text-slate-900">AI Remediation</span>
                  </div>
                  <p className="text-xs text-slate-500">Get AI-powered fix suggestions for each finding.</p>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl px-5 py-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="font-semibold text-red-900">Scan Failed</div>
                <div className="text-sm text-red-700">{error}</div>
              </div>
            </div>
          )}

          {/* Scan Summary */}
          {scanResult && (
            <div className="mb-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {/* Total Findings */}
                <div className={`rounded-xl p-4 shadow-sm border ${scanResult.has_critical ? "bg-red-50 border-red-200" :
                  scanResult.has_high ? "bg-orange-50 border-orange-200" :
                    totalFindings > 0 ? "bg-yellow-50 border-yellow-200" :
                      "bg-green-50 border-green-200"
                  }`}>
                  <div className="text-2xl font-bold text-slate-900">{totalFindings}</div>
                  <div className="text-sm text-slate-600">Secrets Found</div>
                </div>

                {/* Files Affected */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="text-2xl font-bold text-slate-900">{scanResult.files_affected}</div>
                  <div className="text-sm text-slate-600">Files Affected</div>
                </div>

                {/* Severity Breakdown */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 col-span-2">
                  <div className="text-sm font-medium text-slate-600 mb-2">Severity Breakdown</div>
                  <div className="flex gap-3">
                    {scanResult.severity_breakdown.CRITICAL > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-600"></span>
                        <span className="text-sm font-semibold">{scanResult.severity_breakdown.CRITICAL} Critical</span>
                      </div>
                    )}
                    {scanResult.severity_breakdown.HIGH > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        <span className="text-sm font-semibold">{scanResult.severity_breakdown.HIGH} High</span>
                      </div>
                    )}
                    {scanResult.severity_breakdown.MEDIUM > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                        <span className="text-sm font-semibold">{scanResult.severity_breakdown.MEDIUM} Medium</span>
                      </div>
                    )}
                    {scanResult.severity_breakdown.LOW > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="text-sm font-semibold">{scanResult.severity_breakdown.LOW} Low</span>
                      </div>
                    )}
                    {totalFindings === 0 && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-semibold text-green-700">All Clear!</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scan Duration */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-2xl font-bold text-slate-900">{scanResult.scan_duration}s</span>
                  </div>
                  <div className="text-sm text-slate-600">Scan Duration</div>
                </div>
              </div>

              {/* High Risk Warning */}
              {(scanResult.has_critical || scanResult.has_high) && (
                <div className="mb-6 flex items-center gap-3 rounded-xl px-5 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg">
                  <AlertOctagon className="h-6 w-6 flex-shrink-0" />
                  <div>
                    <div className="font-bold">⚠️ High-Risk Secrets Detected!</div>
                    <div className="text-sm text-red-100">
                      Rotate these secrets immediately. They may already be compromised.
                    </div>
                  </div>
                </div>
              )}

              {/* Export Buttons */}
              {totalFindings > 0 && (
                <div className="flex flex-wrap gap-3 mb-6">
                  <Button variant="outline" onClick={exportJSON} className="gap-2">
                    <FileJson className="h-4 w-4" />
                    Export JSON
                  </Button>
                  <Button variant="outline" onClick={copySummary} className="gap-2">
                    {copiedKey === "summary" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Clipboard className="h-4 w-4" />
                        Copy Summary
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Findings List - Grouped by File */}
          {totalFindings > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-900">Security Findings</h2>
                <div className="text-sm text-slate-500">
                  Grouped by file • {Object.keys(findingsByFile).length} files
                </div>
              </div>

              {Object.entries(findingsByFile).map(([filePath, fileFindings]) => (
                <details
                  key={filePath}
                  className="group rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
                  open
                >
                  <summary className="list-none cursor-pointer select-none">
                    <div className="flex items-center justify-between gap-3 p-5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 shadow-md">
                          <FileText className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 font-mono text-sm">
                            {filePath}
                          </div>
                          <div className="text-xs text-slate-500">
                            {fileFindings.length} finding{fileFindings.length > 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Severity badges */}
                        {fileFindings.some((f) => f.severity === "CRITICAL") && (
                          <span className="px-2 py-1 text-xs font-bold bg-red-600 text-white rounded-full">
                            CRITICAL
                          </span>
                        )}
                        {fileFindings.some((f) => f.severity === "HIGH") && (
                          <span className="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-full">
                            HIGH
                          </span>
                        )}
                        <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-slate-100 bg-slate-50/50 divide-y divide-slate-100">
                    {fileFindings.map((f, idx) => {
                      const key = `${f.file_path}-${f.line_number}-${idx}`;
                      const isRevealed = revealedSecrets.has(key);

                      return (
                        <div key={key} className="p-5">
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
                            <span className="inline-flex items-center rounded-lg bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                              Line {f.line_number}
                            </span>
                            <span className="inline-flex items-center rounded-lg bg-blue-100 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">
                              {f.secret_type}
                            </span>
                            {f.confidence && (
                              <span className="inline-flex items-center rounded-lg bg-purple-100 border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700">
                                {f.confidence} Confidence
                              </span>
                            )}
                            {f.entropy !== undefined && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-100 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700">
                                Entropy: {f.entropy}
                                <EducationTooltip topic="entropy" />
                              </span>
                            )}
                            {f.scanner_source && (
                              <span className="inline-flex items-center rounded-lg bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                                via {f.scanner_source}
                              </span>
                            )}
                          </div>

                          {/* Code Viewer */}
                          <div className="rounded-xl bg-slate-900 shadow-xl overflow-hidden mb-4">
                            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3 bg-slate-800/50">
                              <div className="flex items-center gap-2">
                                <div className="flex gap-1.5">
                                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                                </div>
                                <span className="text-xs font-medium text-slate-400 ml-2">
                                  {f.file_path.split("/").pop()} • Line {f.line_number}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors"
                                  onClick={() => toggleRevealSecret(key)}
                                >
                                  {isRevealed ? (
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
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors"
                                  onClick={() => copyText(f.raw_value ? maskSecret(f.raw_value, false) : "", key + "-copy")}
                                >
                                  {copiedKey === key + "-copy" ? (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
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
                            <pre className="max-h-60 overflow-auto p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-100 font-mono">
                              {f.code_snippet || f.leaked_line}
                            </pre>
                          </div>

                          {/* Masked Secret Display */}
                          {f.raw_value && (
                            <div className="mb-4 p-3 bg-slate-100 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Lock className="h-4 w-4 text-slate-400" />
                                  <span className="text-sm font-medium text-slate-600">Detected Value:</span>
                                  <EducationTooltip topic="masking" />
                                </div>
                                <span className="font-mono text-sm text-slate-700">
                                  {maskSecret(f.raw_value, isRevealed)}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Threat Context Analysis */}
                          {f.threat_context && (
                            <div className="mb-4 p-4 bg-slate-800 rounded-xl text-white">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-blue-400" />
                                  <span className="text-sm font-semibold">Threat Analysis</span>
                                </div>
                                <ThreatContextBadge context={f.threat_context} />
                              </div>

                              {/* Quick Summary */}
                              <div className="text-sm text-slate-300 mb-3">
                                {f.threat_context.context_notes[0]}
                              </div>

                              {/* Expandable Details */}
                              <ThreatContextDetails context={f.threat_context} />
                            </div>
                          )}

                          {/* AI Recommendation */}
                          {f.ai_fix?.suggestion && (
                            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md overflow-hidden">
                              <div className="flex items-center gap-2 border-b border-blue-200 bg-white/50 backdrop-blur-sm px-4 py-3">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 shadow-sm">
                                  <Zap className="h-4 w-4 text-white" />
                                </div>
                                <span className="text-sm font-bold text-blue-900">AI Security Recommendation</span>
                              </div>
                              <div className="p-5 max-h-[600px] overflow-y-auto prose prose-sm max-w-none">
                                <AIResponseMarkdown content={f.ai_fix.suggestion} />
                              </div>
                            </div>
                          )}

                          {f.ai_fix?.error && (
                            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                              <div className="flex items-center gap-2 text-yellow-800">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">AI recommendation unavailable: {f.ai_fix.error}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          )}

          {/* No Findings Success State */}
          {scanResult && totalFindings === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-xl">
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">All Clear! 🎉</h3>
              <p className="text-slate-600 max-w-md mb-4">
                No secrets were detected in this repository. Your code looks secure!
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md">
                <p className="text-sm text-green-800">
                  <strong>Tip:</strong> Even with no findings, always follow best practices: use environment variables,
                  add sensitive files to <code className="bg-green-100 px-1 rounded">.gitignore</code>, and never commit real credentials.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Secret Guardian v1.0.0</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Lock className="h-3.5 w-3.5" />
                Read-only scanning
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                No data stored
              </span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
