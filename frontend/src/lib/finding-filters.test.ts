/**
 * Characterization tests for finding-filters.ts — pins the filter/sort
 * behavior moved out of app/scan/page.tsx before the hook extraction.
 */

import { describe, expect, it } from "vitest";

import { Finding } from "@/types/scan";
import {
  buildFileTypeOptions,
  buildScannerOptions,
  DEFAULT_SEVERITY_SELECTION,
  filterFindings,
  getFileExtension,
  getOccurrenceCount,
  getPrimaryPath,
  getStableFindingKey,
  sortFindings,
} from "./finding-filters";

const finding = (over: Partial<Finding> = {}): Finding =>
  ({
    secret_type: "Generic API Key",
    file_path: "src/config.py",
    line_number: 3,
    severity: "HIGH",
    scanner_source: "regex",
    ...over,
  }) as Finding;

const baseFilter = {
  search: "",
  selectedSeverities: { ...DEFAULT_SEVERITY_SELECTION },
  selectedFileTypes: [] as string[],
  selectedScanners: [] as string[],
};

describe("getFileExtension", () => {
  it.each([
    ["src/app/config.py", ".py"],
    ["a/b/.env", ".env"], // dotfile keeps its name
    ["src/.env.production", ".production"], // dotfile WITH extra dot: last suffix
    ["Makefile", "(no ext)"],
    ["", "(unknown)"],
    ["dir/UPPER.JSON", ".json"],
  ])("%s -> %s", (path, expected) => {
    expect(getFileExtension(path)).toBe(expected);
  });
});

describe("occurrence helpers", () => {
  it("prefers occurrence_count, then numeric occurrences, then array length, then 1", () => {
    expect(getOccurrenceCount(finding({ occurrence_count: 7 } as Partial<Finding>))).toBe(7);
    expect(getOccurrenceCount(finding({ occurrences: 3 } as Partial<Finding>))).toBe(3);
    expect(
      getOccurrenceCount(
        finding({
          occurrences: [
            { file_path: "a", line_number: 1 },
            { file_path: "b", line_number: 2 },
          ],
        } as Partial<Finding>)
      )
    ).toBe(2);
    expect(getOccurrenceCount(finding())).toBe(1);
  });

  it("primary path prefers first occurrence over file_path", () => {
    expect(
      getPrimaryPath(
        finding({
          occurrences: [{ file_path: "occ/path.ts", line_number: 9 }],
        } as Partial<Finding>)
      )
    ).toBe("occ/path.ts");
    expect(getPrimaryPath(finding())).toBe("src/config.py");
  });

  it("stable key includes fingerprint, type, path, line, occurrences", () => {
    const key = getStableFindingKey(
      finding({
        secret_fingerprint: "fp",
        occurrences: [{ file_path: "a.ts", line_number: 4 }],
      } as Partial<Finding>)
    );
    expect(key).toBe("fp|Generic API Key|src/config.py|3|a.ts:4");
  });
});

describe("option builders", () => {
  it("dedupes and sorts file types and scanners", () => {
    const findings = [
      finding({ file_path: "b.py" }),
      finding({ file_path: "a.ts" }),
      finding({ file_path: "c.py" }),
      finding({ source_scanners: ["TruffleHog", "regex"] } as Partial<Finding>),
    ];
    expect(buildFileTypeOptions(findings)).toEqual([".py", ".ts"]);
    expect(buildScannerOptions(findings)).toEqual(["regex", "trufflehog"]);
  });
});

describe("filterFindings", () => {
  it("drops deselected severities (missing severity counts as LOW)", () => {
    const list = [finding({ severity: "LOW" }), finding({ severity: undefined } as Partial<Finding>), finding()];
    const state = {
      ...baseFilter,
      selectedSeverities: { ...DEFAULT_SEVERITY_SELECTION, LOW: false },
    };
    expect(filterFindings(list, state)).toHaveLength(1);
  });

  it("applies file-type and scanner filters together", () => {
    const list = [
      finding({ file_path: "a.py", scanner_source: "regex" }),
      finding({ file_path: "b.ts", scanner_source: "regex" }),
      finding({ file_path: "c.py", scanner_source: "gitleaks" }),
    ];
    const state = {
      ...baseFilter,
      selectedFileTypes: [".py"],
      selectedScanners: ["REGEX"], // case-insensitive
    };
    expect(filterFindings(list, state)).toHaveLength(1);
    expect(filterFindings(list, state)[0].file_path).toBe("a.py");
  });

  it("searches path, type, and occurrence locations", () => {
    const list = [
      finding({ secret_type: "AWS Access Key ID" }),
      finding({
        occurrences: [{ file_path: "deep/nested.ts", line_number: 42 }],
      } as Partial<Finding>),
      finding(),
    ];
    expect(filterFindings(list, { ...baseFilter, search: "aws" })).toHaveLength(1);
    expect(filterFindings(list, { ...baseFilter, search: "nested.ts:42" })).toHaveLength(1);
    expect(filterFindings(list, { ...baseFilter, search: "zzz" })).toHaveLength(0);
  });
});

describe("sortFindings", () => {
  const a = finding({ severity: "LOW", file_path: "a.py", occurrence_count: 5 } as Partial<Finding>);
  const b = finding({ severity: "CRITICAL", file_path: "b.py", occurrence_count: 1 } as Partial<Finding>);
  const c = finding({ severity: "CRITICAL", file_path: "c.py", occurrence_count: 3 } as Partial<Finding>);

  it("risk-desc: severity first, then count, then path", () => {
    expect(sortFindings([a, b, c], "risk-desc").map(getPrimaryPath)).toEqual([
      "c.py", // CRITICAL count 3
      "b.py", // CRITICAL count 1
      "a.py", // LOW
    ]);
  });

  it("count-desc: count first, then severity", () => {
    expect(sortFindings([a, b, c], "count-desc").map(getPrimaryPath)).toEqual([
      "a.py", // count 5
      "c.py", // count 3
      "b.py", // count 1
    ]);
  });

  it("file-asc / file-desc sort by primary path", () => {
    expect(sortFindings([c, a, b], "file-asc").map(getPrimaryPath)).toEqual(["a.py", "b.py", "c.py"]);
    expect(sortFindings([a, b, c], "file-desc").map(getPrimaryPath)).toEqual(["c.py", "b.py", "a.py"]);
  });

  it("does not mutate the input array", () => {
    const input = [a, b];
    sortFindings(input, "risk-desc");
    expect(input.map(getPrimaryPath)).toEqual(["a.py", "b.py"]);
  });
});
