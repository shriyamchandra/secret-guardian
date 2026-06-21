/**
 * Pure finding list logic: occurrence access, filter predicates, and sort
 * comparators. Moved verbatim from app/scan/page.tsx (Phase 6.2) so the
 * behavior is unit-testable independent of React state.
 */

import { Finding, Severity } from "@/types/scan";
import { severityRank } from "@/lib/scan-utils";

export type SortOption = "risk-desc" | "count-desc" | "file-asc" | "file-desc";

export const DEFAULT_SEVERITY_SELECTION: Record<Severity, boolean> = {
  CRITICAL: true,
  HIGH: true,
  MEDIUM: true,
  LOW: true,
};

export const getFindingOccurrences = (finding: Finding) =>
  Array.isArray(finding.occurrences) ? finding.occurrences : [];

export const getOccurrenceCount = (finding: Finding) => {
  if (typeof finding.occurrence_count === "number") {
    return finding.occurrence_count;
  }
  if (typeof finding.occurrences === "number") {
    return finding.occurrences;
  }
  const occurrences = getFindingOccurrences(finding);
  return occurrences.length || 1;
};

export const getPrimaryPath = (finding: Finding) =>
  getFindingOccurrences(finding)[0]?.file_path || finding.file_path || "";

export const getFileExtension = (path: string) => {
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

export const getScannerSources = (finding: Finding) => {
  if (finding.source_scanners?.length) {
    return finding.source_scanners
      .map((source) => source.toLowerCase())
      .filter(Boolean);
  }

  const source = String(finding.scanner_source || "").toLowerCase();
  return source ? [source] : [];
};

export const getStableFindingKey = (finding: Finding) => {
  const occurrenceKey = getFindingOccurrences(finding)
    .map((occurrence) => `${occurrence.file_path}:${occurrence.line_number}`)
    .join(",");

  return [
    finding.secret_fingerprint || finding.leaked_line || "",
    finding.secret_type || "",
    finding.file_path || "",
    String(finding.line_number || 0),
    occurrenceKey,
  ].join("|");
};

export const buildFileTypeOptions = (findings: Finding[]) =>
  Array.from(
    new Set(findings.map((finding) => getFileExtension(getPrimaryPath(finding))))
  ).sort((a, b) => a.localeCompare(b));

export const buildScannerOptions = (findings: Finding[]) =>
  Array.from(new Set(findings.flatMap((finding) => getScannerSources(finding))))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

export interface FindingFilterState {
  search: string;
  selectedSeverities: Record<Severity, boolean>;
  selectedFileTypes: string[];
  selectedScanners: string[];
}

export const filterFindings = (
  findings: Finding[],
  { search, selectedSeverities, selectedFileTypes, selectedScanners }: FindingFilterState
) => {
  const query = search.trim().toLowerCase();
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
      ...getFindingOccurrences(finding).map(
        (occurrence) => `${occurrence.file_path}:${occurrence.line_number}`
      ),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });
};

export const sortFindings = (findings: Finding[], sortOption: SortOption) => {
  const sorted = [...findings];
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
};
