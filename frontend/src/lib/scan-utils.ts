import { Severity, Exploitability, RecommendedAction } from "@/types/scan";
import React from "react";
import { AlertOctagon, AlertTriangle, AlertCircle, Info } from "lucide-react";

export const EMPTY_SEVERITY_BREAKDOWN: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 0,
  MEDIUM: 0,
  LOW: 0,
};

export const parseTimeoutMs = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const isGithubUrl = (url: string) =>
  /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\.git)?\/?$/i.test(url.trim());

export const isAbortError = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";

export const getErrorMessage = (payload: unknown, fallback: string): string => {
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

export const parseEventPayload = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export const maskSecret = (value: string, revealed: boolean = false): string => {
  if (!value) return "";
  if (revealed) return value;
  return "••••••••••••";
};

export const getSeverityColor = (severity?: Severity) => {
  switch (severity) {
    case "CRITICAL":
      return "border border-red-700 bg-red-950/70 text-red-200";
    case "HIGH":
      return "border border-red-800 bg-red-950/50 text-red-300";
    case "MEDIUM":
      return "border border-orange-700 bg-orange-950/60 text-orange-200";
    case "LOW":
      return "border border-orange-800 bg-orange-950/40 text-orange-300";
    default:
      return "border border-zinc-700 bg-zinc-800 text-zinc-200";
  }
};

export const getSeverityIcon = (severity?: Severity) => {
  switch (severity) {
    case "CRITICAL":
      return React.createElement(AlertOctagon, { className: "h-3 w-3" });
    case "HIGH":
      return React.createElement(AlertTriangle, { className: "h-3 w-3" });
    case "MEDIUM":
      return React.createElement(AlertCircle, { className: "h-3 w-3" });
    default:
      return React.createElement(Info, { className: "h-3 w-3" });
  }
};

export const getExploitabilityColor = (exploitability?: Exploitability) => {
  switch (exploitability) {
    case "EXPLOITABLE_NOW":
      return "bg-red-950/60 text-red-200 border-red-800";
    case "BAD_PRACTICE":
      return "bg-orange-950/50 text-orange-200 border-orange-800";
    case "LIKELY_FALSE_POSITIVE":
      return "bg-emerald-950/50 text-emerald-200 border-emerald-800";
    default:
      return "bg-zinc-900 text-zinc-300 border-zinc-700";
  }
};

export const getExploitabilityLabel = (exploitability?: Exploitability) => {
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

export const getActionLabel = (action?: RecommendedAction) => {
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

export const severityRank = (severity?: Severity) => {
  switch (severity) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
};

export const getHighestSeverity = (severities: Array<Severity | undefined>) => {
  let highest: Severity | undefined;
  let highestRank = 0;

  for (const severity of severities) {
    const rank = severityRank(severity);
    if (rank > highestRank && severity) {
      highestRank = rank;
      highest = severity;
    }
  }

  return highest;
};
