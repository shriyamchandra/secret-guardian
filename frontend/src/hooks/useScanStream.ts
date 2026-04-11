import { useEffect, useRef, useState, useCallback } from "react";
import { Finding, ScanResult, Severity } from "@/types/scan";
import { isAbortError, getErrorMessage, parseEventPayload, EMPTY_SEVERITY_BREAKDOWN } from "@/lib/scan-utils";

export const useScanStream = (timeoutMs: number) => {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const scanAbortRef = useRef<AbortController | null>(null);
  const scanStreamRef = useRef<EventSource | null>(null);
  const streamFindingKeysRef = useRef<Set<string>>(new Set());
  const pendingAiUpdatesRef = useRef<Map<number, Finding["ai_fix"]>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scanAbortRef.current?.abort();
      scanAbortRef.current = null;
      scanStreamRef.current?.close();
      scanStreamRef.current = null;
    };
  }, []);

  const resetState = useCallback(() => {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    scanStreamRef.current?.close();
    scanStreamRef.current = null;

    setError("");
    setScanResult(null);
    streamFindingKeysRef.current = new Set();
    pendingAiUpdatesRef.current = new Map();
    setLoading(true);
    setProgress("");
  }, []);

  const startTimedRequest = () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    scanAbortRef.current = controller;
    return {
      controller,
      signal: controller.signal,
      clear: () => window.clearTimeout(timeoutId),
    };
  };

  const applyAiFindingUpdate = useCallback((index: number, aiFix: Finding["ai_fix"]) => {
    if (!aiFix) return;
    setScanResult((prev) => {
      if (!prev || index < 0 || index >= prev.findings.length) {
        pendingAiUpdatesRef.current.set(index, aiFix);
        return prev;
      }
      const nextFindings = [...prev.findings];
      nextFindings[index] = { ...nextFindings[index], ai_fix: aiFix };
      return { ...prev, findings: nextFindings };
    });
  }, []);

  const mergePendingAiUpdates = useCallback((result: ScanResult): ScanResult => {
    if (pendingAiUpdatesRef.current.size === 0) return result;
    const nextFindings = [...result.findings];
    for (const [index, aiFix] of pendingAiUpdatesRef.current.entries()) {
      if (index >= 0 && index < nextFindings.length && aiFix) {
        nextFindings[index] = { ...nextFindings[index], ai_fix: aiFix };
        pendingAiUpdatesRef.current.delete(index);
      }
    }
    return { ...result, findings: nextFindings };
  }, []);

  const appendStreamFinding = useCallback((finding: Finding) => {
    const dedupeKey = `${finding.file_path}|${finding.line_number}|${finding.secret_type}`.toLowerCase();
    if (streamFindingKeysRef.current.has(dedupeKey)) return;
    streamFindingKeysRef.current.add(dedupeKey);

    setScanResult((prev) => {
      const nextFindings = prev ? [...prev.findings, finding] : [finding];
      const severityBreakdown: Record<Severity, number> = { ...EMPTY_SEVERITY_BREAKDOWN };
      for (const item of nextFindings) {
        if (item.severity && item.severity in severityBreakdown) {
          severityBreakdown[item.severity] += 1;
        }
      }
      const filesAffected = new Set(nextFindings.map((f) => f.file_path)).size;
      const base: ScanResult = prev ?? {
        findings: [], total_findings: 0, files_affected: 0,
        severity_breakdown: { ...EMPTY_SEVERITY_BREAKDOWN },
        scan_duration: 0, scanners_used: [], has_critical: false, has_high: false,
      };

      return {
        ...base,
        findings: nextFindings, total_findings: nextFindings.length,
        files_affected: filesAffected, severity_breakdown: severityBreakdown,
        has_critical: severityBreakdown.CRITICAL > 0, has_high: severityBreakdown.HIGH > 0,
      };
    });
  }, []);

  const runUploadScan = async (uploadedFile: File, apiUrl: string) => {
    resetState();
    setProgress("Uploading file...");
    const request = startTimedRequest();

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      setProgress("Connecting upload scan stream...");
      const response = await fetch(`${apiUrl}/scan/upload/stream`, {
        method: "POST", body: formData, signal: request.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(data, "Upload scan failed"));
      }
      if (!response.body) throw new Error("Upload stream is unavailable. Please retry.");

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

          if (!rawEvent.trim()) continue;

          let eventName = "message";
          const dataParts: string[] = [];
          for (const rawLine of rawEvent.split(/\r?\n/)) {
            const line = rawLine.trimEnd();
            if (!line || line.startsWith(":")) continue;
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataParts.push(line.slice(5).trimStart());
          }
          if (dataParts.length === 0) continue;

          const payload = parseEventPayload(dataParts.join("\n"));

          if (eventName === "progress" && payload.message) {
            setProgress(payload.message as string);
          } else if (eventName === "scan_result") {
            setScanResult(mergePendingAiUpdates(payload as unknown as ScanResult));
          } else if (eventName === "scan_finding") {
            appendStreamFinding(payload.finding as Finding);
          } else if (eventName === "ai_finding") {
            applyAiFindingUpdate(Number(payload.index), payload.ai_fix as Finding["ai_fix"]);
          } else if (eventName === "ai_complete") {
            setScanResult(prev => prev ? { ...prev, ai_stats: payload.ai_stats as ScanResult["ai_stats"] } : prev);
          } else if (eventName === "scan_error") {
            throw new Error((payload.message as string) || "Upload scan failed.");
          } else if (eventName === "complete") {
            streamCompleted = true;
          }
        }
      }
      if (!streamCompleted) throw new Error("Upload scan stream ended unexpectedly.");
    } catch (e: unknown) {
      setError(isAbortError(e) ? `Upload scan timed out. Try a smaller ZIP.` : (e instanceof Error ? e.message : "Failed to scan."));
    } finally {
      request.clear();
      setLoading(false);
      setProgress("");
    }
  };

  const runUrlScan = (repoUrl: string, apiUrl: string) => {
    resetState();
    setProgress("Connecting to scan stream...");

    const stream = new EventSource(`${apiUrl}/scan/stream?repo_url=${encodeURIComponent(repoUrl)}`);
    scanStreamRef.current = stream;

    let completed = false;
    const isActiveStream = () => scanStreamRef.current === stream && !completed;
    const timeoutId = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      stream.close();
      if (scanStreamRef.current === stream) scanStreamRef.current = null;
      setError(`Scan timed out. Try a smaller repository.`);
      setLoading(false);
      setProgress("");
    }, timeoutMs);

    const finalizeStream = () => {
      if (completed) return;
      completed = true;
      window.clearTimeout(timeoutId);
      stream.close();
      if (scanStreamRef.current === stream) scanStreamRef.current = null;
      setLoading(false);
      setProgress("");
    };

    stream.addEventListener("progress", (e) => {
      if (isActiveStream()) setProgress(parseEventPayload((e as MessageEvent).data).message as string);
    });

    stream.addEventListener("scan_result", (e) => {
      if (isActiveStream()) setScanResult(mergePendingAiUpdates(parseEventPayload((e as MessageEvent).data) as unknown as ScanResult));
    });

    stream.addEventListener("scan_finding", (e) => {
      if (isActiveStream()) appendStreamFinding(parseEventPayload((e as MessageEvent).data).finding as Finding);
    });

    stream.addEventListener("ai_finding", (e) => {
      if (isActiveStream()) {
        const payload = parseEventPayload((e as MessageEvent).data);
        applyAiFindingUpdate(Number(payload.index), payload.ai_fix as Finding["ai_fix"]);
      }
    });

    stream.addEventListener("ai_complete", (e) => {
      if (isActiveStream()) {
        const payload = parseEventPayload((e as MessageEvent).data);
        setScanResult(prev => prev ? { ...prev, ai_stats: payload.ai_stats as ScanResult["ai_stats"] } : prev);
      }
    });

    stream.addEventListener("scan_error", (e) => {
      if (isActiveStream()) {
        setError(parseEventPayload((e as MessageEvent).data).message as string || "Scan failed.");
        finalizeStream();
      }
    });

    stream.addEventListener("complete", () => isActiveStream() && finalizeStream());
    stream.onerror = () => {
      if (isActiveStream()) {
        setError("Scan stream disconnected unexpectedly.");
        finalizeStream();
      }
    };
  };

  const cancelScan = () => {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    scanStreamRef.current?.close();
    scanStreamRef.current = null;
    setLoading(false);
    setProgress("");
  };

  return { scanResult, loading, error, progress, runUploadScan, runUrlScan, cancelScan, setScanResult, setError };
};
