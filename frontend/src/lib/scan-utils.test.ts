/**
 * Characterization tests for the pure logic in scan-utils.ts
 * (frontend migration Phase 6.0 — the safety net before splitting the
 * page monoliths). These pin CURRENT behavior; intentional changes
 * should update the assertion and say why in the commit.
 */

import { describe, expect, it } from "vitest";

import {
  getErrorMessage,
  getExploitabilityLabel,
  getActionLabel,
  getHighestSeverity,
  isSupportedRepoUrl,
  maskSecret,
  parseEventPayload,
  parseTimeoutMs,
  severityRank,
} from "./scan-utils";

describe("parseTimeoutMs", () => {
  it("parses positive numeric strings", () => {
    expect(parseTimeoutMs("5000", 99)).toBe(5000);
  });
  it.each(["", "abc", "-1", "0", undefined])(
    "falls back for %j",
    (value) => {
      expect(parseTimeoutMs(value as string | undefined, 99)).toBe(99);
    },
  );
});

describe("isSupportedRepoUrl", () => {
  it.each([
    "https://github.com/user/repo",
    "https://github.com/user/repo.git",
    "https://www.github.com/user/repo/",
    "https://bitbucket.org/team/repo",
    "https://gitlab.com/group/subgroup/repo",
  ])("accepts %s", (url) => {
    expect(isSupportedRepoUrl(url)).toBe(true);
  });

  it.each([
    "http://github.com/user/repo", // http not allowed
    "https://github.com/user", // missing repo
    "https://example.com/user/repo",
    "git@github.com:user/repo.git", // ssh form
    "",
  ])("rejects %s", (url) => {
    expect(isSupportedRepoUrl(url)).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(isSupportedRepoUrl("  https://github.com/user/repo  ")).toBe(true);
  });
});

describe("getErrorMessage", () => {
  it("passes through strings", () => {
    expect(getErrorMessage("boom", "fallback")).toBe("boom");
  });
  it("reads detail / message / error keys", () => {
    expect(getErrorMessage({ detail: "d" }, "f")).toBe("d");
    expect(getErrorMessage({ message: "m" }, "f")).toBe("m");
    expect(getErrorMessage({ error: "e" }, "f")).toBe("e");
  });
  it("reads nested detail objects", () => {
    expect(getErrorMessage({ detail: { message: "nested" } }, "f")).toBe("nested");
    expect(getErrorMessage({ detail: { error: "nested-e" } }, "f")).toBe("nested-e");
  });
  it("falls back for null/unknown shapes", () => {
    expect(getErrorMessage(null, "f")).toBe("f");
    expect(getErrorMessage({ other: 1 }, "f")).toBe("f");
    expect(getErrorMessage(42, "f")).toBe("f");
  });
});

describe("parseEventPayload", () => {
  it("parses JSON objects", () => {
    expect(parseEventPayload('{"a":1}')).toEqual({ a: 1 });
  });
  it("returns {} for invalid JSON and non-objects", () => {
    expect(parseEventPayload("not json")).toEqual({});
    expect(parseEventPayload("42")).toEqual({});
    expect(parseEventPayload("null")).toEqual({});
  });
});

describe("maskSecret", () => {
  // CHARACTERIZATION OF A KNOWN BUG: UI masking is currently disabled by a
  // DEBUG hack in scan-utils.ts — raw values are returned even when not
  // revealed. When masking is restored, flip these assertions.
  it("currently returns the raw value even when not revealed (DEBUG state)", () => {
    expect(maskSecret("super-secret", false)).toBe("super-secret");
  });
  it("returns empty string for empty input", () => {
    expect(maskSecret("", false)).toBe("");
  });
});

describe("severity helpers", () => {
  it("ranks severities in order", () => {
    expect(severityRank("CRITICAL")).toBe(4);
    expect(severityRank("HIGH")).toBe(3);
    expect(severityRank("MEDIUM")).toBe(2);
    expect(severityRank("LOW")).toBe(1);
    expect(severityRank(undefined)).toBe(0);
  });
  it("picks the highest severity, ignoring undefined", () => {
    expect(getHighestSeverity(["LOW", undefined, "HIGH", "MEDIUM"])).toBe("HIGH");
    expect(getHighestSeverity([undefined])).toBeUndefined();
    expect(getHighestSeverity([])).toBeUndefined();
  });
});

describe("labels", () => {
  it("maps exploitability to labels", () => {
    expect(getExploitabilityLabel("EXPLOITABLE_NOW")).toBe("🚨 Exploitable Now");
    expect(getExploitabilityLabel("BAD_PRACTICE")).toBe("⚡ Bad Practice");
    expect(getExploitabilityLabel("LIKELY_FALSE_POSITIVE")).toBe("✅ Likely Safe");
    expect(getExploitabilityLabel(undefined)).toBe("Unknown");
  });
  it("maps recommended actions to labels", () => {
    expect(getActionLabel("ROTATE_NOW")).toBe("Rotate Immediately");
    expect(getActionLabel("FIX_WHEN_POSSIBLE")).toBe("Fix When Possible");
    expect(getActionLabel("REVIEW")).toBe("Review & Verify");
    expect(getActionLabel("IGNORE")).toBe("Can Ignore");
    expect(getActionLabel(undefined)).toBe("Unknown");
  });
});
