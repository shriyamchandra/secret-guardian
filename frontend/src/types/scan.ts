export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Exploitability = "EXPLOITABLE_NOW" | "BAD_PRACTICE" | "LIKELY_FALSE_POSITIVE";
export type RecommendedAction = "ROTATE_NOW" | "FIX_WHEN_POSSIBLE" | "REVIEW" | "IGNORE";

export type ThreatContext = {
  risk_level: Severity | "INFO";
  exploitability: Exploitability;
  context_notes: string[];
  confidence: number;
  recommended_action: RecommendedAction;
  risk_factors: string[];
  mitigating_factors: string[];
};

export type FindingOccurrence = {
  file_path: string;
  line_number: number;
};

export type Finding = {
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
  source_scanners?: string[];
  occurrences?: FindingOccurrence[];
  occurrence_count?: number;
  threat_context?: ThreatContext;
  ai_fix?: {
    suggestion?: string;
    error?: string;
    threat_context?: ThreatContext;
    ai_generated?: boolean;
    ai_status?: string;
  };
};

export type ScanResult = {
  findings: Finding[];
  total_findings: number;
  files_affected: number;
  severity_breakdown: Record<Severity, number>;
  scan_duration: number;
  displayed_findings?: number;
  findings_truncated?: boolean;
  truncated_findings?: number;
  findings_limit?: number;
  scanners_used: string[];
  aggregated_findings?: boolean;
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
