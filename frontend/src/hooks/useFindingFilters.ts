"use client";

import { useMemo, useState } from "react";

import {
  DEFAULT_SEVERITY_SELECTION,
  buildFileTypeOptions,
  buildScannerOptions,
  filterFindings,
  sortFindings,
  type SortOption,
} from "@/lib/finding-filters";
import { Finding, Severity } from "@/types/scan";

/** Search / severity / file-type / scanner filters plus sorting for the
 * findings list. Pure logic lives in lib/finding-filters.ts. */
export function useFindingFilters(findings: Finding[]) {
  const [findingSearch, setFindingSearch] = useState("");
  const [selectedSeverities, setSelectedSeverities] = useState<
    Record<Severity, boolean>
  >({ ...DEFAULT_SEVERITY_SELECTION });
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [selectedScanners, setSelectedScanners] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("risk-desc");

  const fileTypeOptions = useMemo(() => buildFileTypeOptions(findings), [findings]);
  const scannerOptions = useMemo(() => buildScannerOptions(findings), [findings]);

  const filteredFindings = useMemo(
    () =>
      filterFindings(findings, {
        search: findingSearch,
        selectedSeverities,
        selectedFileTypes,
        selectedScanners,
      }),
    [findings, findingSearch, selectedSeverities, selectedFileTypes, selectedScanners]
  );

  const sortedFindings = useMemo(
    () => sortFindings(filteredFindings, sortOption),
    [filteredFindings, sortOption]
  );

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

  const reset = () => {
    setFindingSearch("");
    setSelectedSeverities({ ...DEFAULT_SEVERITY_SELECTION });
    setSelectedFileTypes([]);
    setSelectedScanners([]);
    setSortOption("risk-desc");
  };

  return {
    findingSearch,
    setFindingSearch,
    selectedSeverities,
    selectedFileTypes,
    selectedScanners,
    sortOption,
    setSortOption,
    fileTypeOptions,
    scannerOptions,
    filteredFindings,
    sortedFindings,
    toggleSeverity,
    toggleFileType,
    toggleScannerSource,
    reset,
  };
}
