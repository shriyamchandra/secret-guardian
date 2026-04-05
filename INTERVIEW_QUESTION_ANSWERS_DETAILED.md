# Secret Guardian - Detailed Interview Question & Answer Handbook

This document is a deep interview-prep guide for the Secret Guardian project.

## Snapshot (for consistency in interviews)

- Project: `Secret Guardian`
- Backend: FastAPI + Python 3.12
- Frontend: Next.js + React + TypeScript
- Detection: Regex patterns + entropy + optional Gitleaks/TruffleHog
- AI remediation: Google Gemini (`gemini-2.0-flash-exp`)
- Key backend modules:
  - `backend/main.py`
  - `backend/scanner.py`
  - `backend/patterns.py`
  - `backend/external_scanners.py`
  - `backend/ai_fixer.py`
  - `backend/cache.py`
  - `backend/rate_limiter.py`
  - `backend/validators.py`
  - `backend/performance.py`
- Key frontend modules:
  - `frontend/src/app/scan/page.tsx`
  - `frontend/src/components/AIResponseMarkdown.tsx`
  - `frontend/src/app/page.tsx`

## How To Use This Document

- Use Section 1 for your first 2-3 minutes of any interview.
- Use Sections 2-8 for technical rounds.
- Use Section 9 for behavioral rounds.
- Use Section 10 for quick last-minute revision.
- Keep answers honest and grounded in code, not only in old summary docs.

---

## 1. Opening Answers (Most Important)

### Q1. "Tell me about this project in 30 seconds."
**Answer:**
I built Secret Guardian, a full-stack security scanner that analyzes public GitHub repositories and uploaded ZIP codebases for leaked secrets like API keys, tokens, and DB credentials. The backend uses FastAPI with a multi-scanner detection pipeline, confidence scoring, and threat-context analysis. The frontend groups findings by file and gives AI-generated remediation guidance using Gemini. I also added operational features like rate limiting, caching, validation, and performance monitoring.

### Q2. "Give me the 2-minute version."
**Answer:**
Secret Guardian solves a real issue: developers accidentally committing credentials. The system supports two scanning inputs, GitHub URL and ZIP upload. The scan engine combines regex patterns, entropy-informed confidence filtering, and optional external scanners like Gitleaks and TruffleHog. Findings are normalized into a shared schema, deduplicated, severity-ranked, and enriched with context-aware threat modeling.

Then Gemini generates remediation recommendations tailored to framework context. The frontend shows grouped findings, threat badges, code snippets, masked values, and export options. On the non-functional side, I added per-IP rate limiting, in-memory TTL caching, strict URL validation/sanitization, global error handlers, and runtime metrics endpoints.

### Q3. "What problem are you solving exactly?"
**Answer:**
I’m reducing the time from "secret leaked" to "secret detected and remediated." Most tools either detect without guidance or require heavy setup. Secret Guardian gives a simple scan workflow and immediate fix guidance.

### Q4. "Why is this project meaningful?"
**Answer:**
Credential leakage is high-impact and common. Even one exposed cloud key can cause billing abuse or data compromise. This project demonstrates both security detection and practical developer remediation.

### Q5. "What makes this project technically non-trivial?"
**Answer:**
The non-trivial parts are signal quality and workflow reliability:
- reducing false positives,
- normalizing outputs across scanners,
- context-aware severity/urgency,
- parallel AI suggestion generation,
- and operational hardening (rate/cache/validation/monitoring).

---

## 2. Product and Architecture Questions

### Q6. "What are the major components?"
**Answer:**
Three layers:
1. Frontend (Next.js) for input, visualization, and export actions.
2. Backend API orchestration (`main.py`) for validation, rate limit, cache, scanning, AI enrichment.
3. Scan engine (`scanner.py`, `patterns.py`, `external_scanners.py`) plus AI layer (`ai_fixer.py`).

### Q7. "Walk me through a URL scan request end-to-end."
**Answer:**
`POST /scan` flow:
1. Identify client IP.
2. Enforce rate limit via `rate_limiter.check_rate_limit`.
3. Validate and sanitize repo URL via `validate_scan_request`.
4. Check cache by normalized URL.
5. Clone repo shallowly to temp dir.
6. Run regex scanner and optional external scanners.
7. Normalize + dedupe + severity breakdown.
8. Add threat context for each finding.
9. Generate AI fixes concurrently with `asyncio.to_thread(...)` + `gather`.
10. Cache result and return payload.
11. Cleanup temp directory.

### Q8. "What happens in ZIP upload mode?"
**Answer:**
`POST /scan/upload` accepts multipart ZIP, validates type and size (max 50MB), securely extracts into temp dir with path traversal checks, scans extracted content, enriches with threat context + AI suggestions, and always cleans up in `finally`.

### Q9. "How is temporary data handled?"
**Answer:**
Clone/extraction always occurs in temporary directories created by `tempfile.mkdtemp`, and cleanup runs in `finally` blocks using `shutil.rmtree`.

### Q10. "How do you keep API responses consistent across scanners?"
**Answer:**
I normalize all outputs into one `Finding` dataclass in `external_scanners.py` and convert to dicts before returning.

### Q11. "How do you prioritize findings?"
**Answer:**
I do it in layers:
- confidence filter (drop LOW confidence regex matches),
- severity assignment,
- threat context exploitability,
- sorted output by severity/file/line.

### Q12. "How do you avoid duplicate alerts?"
**Answer:**
`deduplicate_findings` uses `(file_path, line_number, normalized_secret_type)` as key and keeps the stronger/more useful variant by severity/context.

### Q13. "What are current functional limitations?"
**Answer:**
- Public repo scanning only for URL mode.
- No persistent scan history database.
- No commit-history scan in current execution mode.
- External scanner coverage depends on local installation.

### Q14. "How would you explain architecture to a non-security interviewer?"
**Answer:**
Think of it as: ingestion -> detection -> prioritization -> explanation. The tool finds risky text patterns, ranks urgency, and tells the developer how to fix safely.

---

## 3. Backend and API Questions

### Q15. "Why FastAPI instead of Flask?"
**Answer:**
I chose FastAPI for typed request/response models, automatic OpenAPI docs, async support, and strong developer ergonomics for API-first workflows.

### Q16. "Which endpoints did you implement?"
**Answer:**
Core endpoints:
- `GET /`, `GET /health`, `GET /info`
- `POST /scan`, `POST /scan/upload`
- `POST /export/json`, `POST /export/summary`
Admin endpoints:
- `/admin/stats`, `/admin/cache`, `/admin/cache/clear`, `/admin/rate-limits/{ip}`, `/admin/rate-limits/reset`, `/admin/performance`

### Q17. "What is your error-handling strategy?"
**Answer:**
- Domain validation errors return structured 422 responses.
- Rate-limit violations return 429 with retry guidance.
- Global fallback catches unhandled errors and returns a generic 500 with error ID.
- Full trace logs remain server-side.

### Q18. "How is CORS handled?"
**Answer:**
Allowed origins include localhost defaults and optional `FRONTEND_URL`. If running in Render with missing frontend URL, code currently falls back to wildcard origins for setup convenience.

### Q19. "How do you validate user input safely?"
**Answer:**
`validators.py` checks:
- GitHub URL format,
- dangerous patterns (`../`, command chaining, script tags),
- URL length and owner/repo naming validity,
and sanitizes git-style URLs to canonical HTTPS.

### Q20. "What are your scan timeouts and limits?"
**Answer:**
Defaults in code:
- total scan timeout ~300s,
- clone timeout bounded by smaller fraction,
- max file size 1MB,
- max files 5000.
Upload has its own size limit (50MB ZIP).

### Q21. "How do you monitor runtime behavior?"
**Answer:**
With `PerformanceMonitor` context manager that captures duration, memory delta, CPU, findings count; exposes aggregate and recent scan metrics via admin endpoints.

### Q22. "How do you prevent expensive repeated scans?"
**Answer:**
In-memory TTL cache (`cache.py`, default 1 hour) keyed by hashed repo URL. On hit, the API returns cached results with age metadata.

### Q23. "Describe your rate limiting implementation."
**Answer:**
Per-IP sliding bucket lists for minute and hour windows. On each request I clean old timestamps, check limits, and return allowed/blocked with retry hint.

### Q24. "How would you improve backend reliability next?"
**Answer:**
- Replace in-memory cache/limits with Redis.
- Add persistent job queue for long scans.
- Add structured logging and tracing.
- Add integration tests and contract tests.

### Q25. "Did you find any code-level bug in your own review?"
**Answer:**
Yes. `POST /scan/upload` currently calls `rate_limiter.is_allowed`, but the implemented limiter method is `check_rate_limit`. That should be fixed for consistency and runtime correctness.

### Q26. "Any config mismatch risks?"
**Answer:**
Yes. Code expects `GOOGLE_API_KEY`, but one deployment blueprint uses `GEMINI_API_KEY`. I’d unify on `GOOGLE_API_KEY` everywhere.

### Q27. "How did you design export functionality?"
**Answer:**
`/export/json` streams a downloadable JSON artifact with metadata; `/export/summary` builds a structured plaintext summary grouped by file for clipboard workflows.

### Q28. "How do you avoid secret leakage in API responses?"
**Answer:**
Detected values are masked using `mask_secret`. A remaining hardening step is masking/redacting snippet lines too, because snippets can still contain real values.

---

## 4. Detection Engine and Algorithm Questions

### Q29. "How many secret types are detected?"
**Answer:**
The current pattern library in `patterns.py` covers 35+ types across major providers and credential formats.

### Q30. "What’s your detection strategy at a high level?"
**Answer:**
Hybrid strategy:
- deterministic regex for known formats,
- entropy signal for randomness,
- confidence scoring to reduce noise,
- external scanners for additional rule coverage.

### Q31. "What is Shannon entropy and why use it?"
**Answer:**
Shannon entropy measures randomness/distribution unpredictability in a string. Many real secrets look random; entropy helps distinguish likely generated secrets from predictable placeholders.

### Q32. "Do you use entropy as a standalone detector?"
**Answer:**
Primarily as part of confidence/scoring for generic detections. It improves quality when explicit provider pattern specificity is low.

### Q33. "How do you handle false positives?"
**Answer:**
I apply placeholder/template/documentation heuristics and context-aware lowering in confidence score. LOW-confidence findings are dropped in regex scan path.

### Q34. "What confidence levels exist?"
**Answer:**
`HIGH`, `MEDIUM`, `LOW` with numeric score. Threshold logic is in `calculate_confidence_score`.

### Q35. "What factors influence confidence score?"
**Answer:**
- Pattern specificity,
- file context (`.env` and config weight higher; test/spec/mock lower),
- false-positive indicators,
- entropy signal for generic token types.

### Q36. "How is severity assigned?"
**Answer:**
`determine_severity` maps high-impact secret categories directly to CRITICAL/HIGH/MEDIUM, then uses confidence+entropy fallback when type is generic/unknown.

### Q37. "How do external scanners integrate with internal scanner?"
**Answer:**
Regex scanner always runs. If availability checks pass, Gitleaks and TruffleHog run too. All findings merge then dedupe.

### Q38. "Why normalize findings instead of exposing raw scanner outputs?"
**Answer:**
Normalization keeps frontend and exports stable, independent of scanner-specific output formats.

### Q39. "How do you determine language for a finding?"
**Answer:**
Simple file extension mapping in `scanner.py`.

### Q40. "How do you avoid scanning huge binaries?"
**Answer:**
I skip known binary/media/build extensions and enforce max file size; I also ignore heavy dependency directories.

### Q41. "What’s the tradeoff of shallow cloning?"
**Answer:**
It’s faster and safer operationally but does not inspect full history. This version focuses on current file state.

### Q42. "How would you benchmark detection quality scientifically?"
**Answer:**
I’d use a labeled corpus, calculate precision/recall/F1 across secret classes, and run A/B tests when adjusting patterns/thresholds.

### Q43. "How would you reduce false negatives?"
**Answer:**
- Broaden pattern coverage,
- incorporate ML classifier for context,
- scan commit history optionally,
- and add provider-specific verification hooks.

### Q44. "How would you reduce false positives further?"
**Answer:**
- Better contextual parsing,
- repository-level whitelisting/baselines,
- developer feedback loop (mark safe),
- and test fixture detection refinement.

### Q45. "What would break detection correctness fastest?"
**Answer:**
Overly broad false-positive filters or aggressive generic rules. I keep balancing precision vs recall through thresholds and typed severity mappings.

---

## 5. AI/LLM Integration Questions

### Q46. "Why use AI if you already detect secrets?"
**Answer:**
Detection tells you "what is wrong." AI helps answer "what should I do now" with practical remediation steps and framework-specific code patterns.

### Q47. "How do you keep AI responses consistent?"
**Answer:**
Prompt is highly structured with required sections and calibrated urgency based on threat context. Temperature is low (0.3) for stability.

### Q48. "How do you avoid alarmist AI output?"
**Answer:**
I precompute threat context (`EXPLOITABLE_NOW`, `BAD_PRACTICE`, `LIKELY_FALSE_POSITIVE`) and include explicit tone/urgency guidance in prompt.

### Q49. "How do you detect framework context?"
**Answer:**
Heuristic detection from file paths and language in `detect_framework`, then inject framework-specific remediation snippets.

### Q50. "How do you handle AI API failures?"
**Answer:**
AI call failures are captured and returned as `ai_fix.error`, so the rest of scan results remain usable.

### Q51. "Is AI call parallelized?"
**Answer:**
Yes. I wrap sync Gemini calls in `asyncio.to_thread` and run them concurrently with `asyncio.gather` for multiple findings.

### Q52. "What would you improve in AI integration?"
**Answer:**
- Response schema enforcement,
- retry/backoff and circuit breaker,
- token/cost telemetry,
- provider abstraction for multi-model fallback.

### Q53. "Any prompt security concerns?"
**Answer:**
Potential prompt injection through code snippets is a known class of risk. I’d harden by stronger delimitation, policy layers, and constrained output schema.

### Q54. "What does success look like for AI output?"
**Answer:**
Clear remediation path, low ambiguity, framework-appropriate fix, and immediate rotation/revocation guidance when high risk.

---

## 6. Frontend Questions

### Q55. "What does the scan page do from a UX standpoint?"
**Answer:**
It supports URL and ZIP modes, validates input, shows progress and errors, groups findings by file, surfaces severity/threat context, and provides export/share actions.

### Q56. "How is frontend API base configured?"
**Answer:**
Through `NEXT_PUBLIC_API_URL` environment variable, used in all fetch calls.

### Q57. "How are findings organized visually?"
**Answer:**
Grouped by file with collapsible sections, each finding showing severity, line, type, confidence, entropy, scanner source, code snippet, masked value, and AI fix.

### Q58. "How is secret masking handled in UI?"
**Answer:**
Masked display by default with reveal confirmation modal; copy action is labeled as masked copy flow.

### Q59. "How do you render AI markdown safely?"
**Answer:**
Using `react-markdown` with custom renderers. Links are externalized with `noopener noreferrer`. Additional hardening can include stricter sanitization policy if HTML support is enabled later.

### Q60. "Why build custom markdown renderers?"
**Answer:**
To improve readability and scanning speed: section headers with icons, syntax-highlighted code blocks, styled lists/tables/quotes.

### Q61. "How do you manage component state in scan page?"
**Answer:**
Local React state with `useState` and computed grouping via `useMemo`; this keeps logic explicit and easy to reason about for one-page workflow.

### Q62. "What frontend code areas would you refactor next?"
**Answer:**
Split `scan/page.tsx` into smaller container/presentation components and extract API client + reusable types into dedicated modules.

### Q63. "What responsiveness/accessibility work is present?"
**Answer:**
Responsive layout classes are used throughout, controls have meaningful labels/icons, and interactive elements have visible states. I’d add more explicit keyboard/focus testing next.

### Q64. "What frontend risk did you notice?"
**Answer:**
The raw snippet block can still reveal true secrets despite masking controls. I’d redact snippet content server-side before rendering.

---

## 7. Security, Privacy, and Compliance Questions

### Q65. "What security controls are implemented?"
**Answer:**
- Input validation and sanitization,
- path traversal checks for ZIP extraction,
- per-IP rate limiting,
- temporary file cleanup,
- masked value handling,
- structured error responses.

### Q66. "How do you protect against ZIP Slip/path traversal?"
**Answer:**
Before extraction, each member path is resolved to absolute path and verified to remain inside the temp extraction directory.

### Q67. "How do you handle abuse prevention?"
**Answer:**
Per-IP minute/hour rate limits. Next step would be adding distributed limits (Redis) and user/API-key based quotas.

### Q68. "How do you ensure sensitive data is not persisted?"
**Answer:**
No DB persistence for repository contents; scan temp dirs are removed post-scan. Cache stores result payloads in memory only.

### Q69. "What’s a security gap you’d admit in interview?"
**Answer:**
Masked raw values are good, but snippet/leaked lines may still expose secrets. I’d treat snippet redaction as a high-priority hardening task.

### Q70. "How do you handle principle of least privilege?"
**Answer:**
Current version avoids GitHub tokens and works with public repos, which reduces credential handling risk. For private repo support, I’d scope OAuth tokens tightly and encrypt at rest.

### Q71. "How would you support audit requirements?"
**Answer:**
I’d add append-only audit logs for scan requests, decisions, and remediation actions, with PII-safe logging and retention controls.

### Q72. "How would you handle legal/ethical concerns of scanning?"
**Answer:**
Restrict scanning to repos user owns/has permission to assess, display explicit terms, and encourage responsible disclosure and immediate secret rotation.

### Q73. "How do you avoid command injection with repo URLs?"
**Answer:**
Strict regex-based allowlist for GitHub URL patterns + dangerous pattern rejection + normalization before use.

### Q74. "How would you design secure private-repo support?"
**Answer:**
OAuth app with minimal scopes, encrypted token storage, short token lifetime, scoped repo selection, and strict audit/event logging.

---

## 8. Performance, Scalability, and System Design Questions

### Q75. "What are your performance optimizations today?"
**Answer:**
- In-memory caching for repeat URL scans,
- skip large/binary/irrelevant files,
- concurrent AI suggestion generation,
- and operational visibility via metrics.

### Q76. "What are likely bottlenecks?"
**Answer:**
- repository clone I/O,
- external scanner runtime,
- per-finding AI latency,
- and single-instance memory cache when traffic scales.

### Q77. "How would you scale this architecture?"
**Answer:**
- Move cache/rate-limit to Redis,
- async job queue for scan tasks,
- worker pool for scanner execution,
- persistent store for scan metadata,
- horizontal API scaling behind load balancer.

### Q78. "How would you support org-wide scanning?"
**Answer:**
Batch scheduler + queue-driven multi-repo jobs + progress tracking + notifications + incremental scans keyed by commit SHA.

### Q79. "How would you reduce P95 latency?"
**Answer:**
- prewarm scanner containers,
- parallelize scanner stages where safe,
- cache AI responses for identical finding signatures,
- optimize file traversal and regex compilation reuse.

### Q80. "How would you avoid AI cost explosion?"
**Answer:**
- only request AI for high-confidence findings,
- deduplicate by secret signature,
- caching and prompt token control,
- tiered recommendation depth by severity.

### Q81. "How would you make rate limiting distributed?"
**Answer:**
Use Redis atomic counters/sliding windows keyed by IP/user/API key with per-route policies.

### Q82. "How would you observe production incidents?"
**Answer:**
Add structured logs, centralized metrics, traces, alerting (error rate/latency/queue depth), and runbooks tied to endpoint ownership.

### Q83. "What SLOs would you define?"
**Answer:**
Example:
- API availability >= 99.9%
- P95 response for cached scans < 500ms
- P95 response for non-cached URL scan < target by repo size tier
- AI suggestion success rate > target threshold

### Q84. "How would you test performance claims?"
**Answer:**
Load test with realistic repo mix, separate cached/non-cached cohorts, track P50/P95/P99, and validate memory growth under sustained concurrency.

### Q85. "How would you support multi-tenant enterprise usage?"
**Answer:**
Tenant isolation in auth, quotas, encryption boundaries, tenant-scoped logs/exports, and configurable policy packs per tenant.

---

## 9. Behavioral and Ownership Questions (STAR-Ready)

### Q86. "Tell me about a difficult bug you found."
**Answer:**
I identified an endpoint integration mismatch: upload flow called a limiter method name not exposed by the limiter class. I isolated it by comparing endpoint calls to implementation surface, documented impact, and prioritized fix because it affects user-visible scanning in ZIP mode.

### Q87. "Tell me about a tradeoff you made."
**Answer:**
I used in-memory cache/rate limits initially for speed of delivery and simplicity. Tradeoff: not horizontally scalable. I documented Redis migration as the next production step.

### Q88. "Tell me about an improvement you made for user trust."
**Answer:**
I emphasized masked displays, reveal warnings, and explicit read-only/no-storage messaging in UI. It helps users understand risk boundaries before interacting with sensitive output.

### Q89. "Describe a time you improved reliability."
**Answer:**
I added layered safeguards in API flow: validation, rate limit, cache controls, structured exceptions, and cleanup in `finally`. This reduced failure blast radius and made behavior easier to debug.

### Q90. "How do you handle incomplete requirements?"
**Answer:**
I implement the core path with explicit assumptions, document limitations clearly, and create incremental extension points. Example: public repo + ZIP first, private repo support planned later.

### Q91. "How do you communicate risk to non-security teams?"
**Answer:**
I translate findings into exploitability and action urgency, not only technical labels. Example: "Rotate now" vs "fix when possible" based on context.

### Q92. "Describe a decision you would revisit."
**Answer:**
I’d standardize configuration contracts earlier across deployment files and code to avoid env-var drift.

### Q93. "How do you ensure your docs stay honest?"
**Answer:**
I treat source code as truth and periodically reconcile docs. Historical summary files can drift, so I maintain one authoritative technical reference.

### Q94. "How do you prioritize next work?"
**Answer:**
By risk and user impact:
1. correctness bug fixes,
2. security hardening,
3. observability/testing,
4. scalability features.

### Q95. "Tell me about technical debt in this project."
**Answer:**
Large single-page scan component and mixed doc consistency are current debts. I’d modularize UI logic and prune/align documentation with code snapshots.

### Q96. "How do you handle feedback that your system is too noisy?"
**Answer:**
I tune confidence thresholds, improve placeholder filters, add user feedback loops, and evaluate precision/recall using labeled benchmarks before release.

### Q97. "If production incident happens, what’s your first response?"
**Answer:**
Triage by blast radius, check health/performance endpoints, inspect recent error IDs/logs, roll back risky changes, then patch root cause with regression tests.

### Q98. "How do you mentor a junior on this codebase?"
**Answer:**
I walk them through request lifecycle first (`/scan` path), then scanning engine, then UI rendering flow. I use module-level responsibilities and endpoint tests as teaching anchors.

### Q99. "How do you make security recommendations actionable?"
**Answer:**
I prefer concrete steps: rotate/revoke, update config pattern, add `.env.example`, add `.gitignore` entries, then verify in CI/pre-commit scanning.

### Q100. "What did you learn personally from this project?"
**Answer:**
Building security tools is more about precision and workflow trust than raw detection count. Usability, clarity, and operational correctness matter as much as algorithm depth.

---

## 10. Advanced Round Questions (Design + Deep Dive)

### Q101. "Design a v2 that supports private repos and scheduled scans."
**Answer:**
- GitHub OAuth + encrypted token vault.
- Scheduler for periodic scans.
- Queue-based workers.
- Persistent findings DB with dedupe history.
- Notification adapters (Slack/email).
- Policy controls per repo/team.

### Q102. "How would you make findings explainable and auditable?"
**Answer:**
Store detection reason metadata: scanner source, rule/pattern ID, entropy score, confidence factors, and threat-context factors.

### Q103. "How would you secure AI outputs from hallucination risk?"
**Answer:**
Constrain output schema, include deterministic remediation templates for high-risk types, and add validation checks before rendering recommendations.

### Q104. "How would you support monorepos efficiently?"
**Answer:**
Path-aware parallel traversal, language-aware scanners, incremental scans by changed files/commits, and scoped caching at directory/module level.

### Q105. "How would you compare this tool with Git hooks and CI scanners?"
**Answer:**
This tool is interactive remediation-focused; pre-commit/CI scanners are preventive gates. Best practice is combining both.

### Q106. "How would you implement pre-commit integration?"
**Answer:**
Create CLI mode wrapping scan engine for local path scan, return non-zero exit on high-confidence/high-severity findings, and include suppressions policy.

### Q107. "How would you support policy exceptions safely?"
**Answer:**
Signed policy file with expiry, reviewer metadata, and scoped suppressions by hash/path/rule to avoid broad permanent ignores.

### Q108. "How would you verify secret validity without causing misuse?"
**Answer:**
Use non-destructive provider-specific introspection endpoints with strict rate control and no storage of plaintext values.

### Q109. "How would you improve dedupe quality?"
**Answer:**
Include hashed secret fingerprints and normalized rule families in dedupe keys, not just line/secret type.

### Q110. "How would you support SARIF output?"
**Answer:**
Add standardized result mapper from internal Finding schema to SARIF format for CI/security platform interoperability.

---

## 11. Honest "Known Gaps" Answers (Use Carefully, Shows Maturity)

### Q111. "What is currently incomplete?"
**Answer:**
- Automated tests are minimal/not yet formalized.
- Upload rate-limit method mismatch needs fixing.
- Snippet redaction needs stronger default safety.
- Deployment config naming should be unified.

### Q112. "What would you fix first if given one day?"
**Answer:**
Correctness and security first:
1. upload limiter bug,
2. snippet redaction,
3. config consistency,
4. smoke tests for core endpoints.

### Q113. "What would you fix first if given one week?"
**Answer:**
- Add backend unit/integration tests,
- add frontend scan-page flow tests,
- Redis-backed cache/rate limit,
- improve observability and structured logs.

---

## 12. Interview Narratives You Can Reuse

### Narrative A: "From detector to platform"
I started with pattern matching, then turned it into a reliable system by adding validation, cache, rate controls, monitoring, and consistent API contracts.

### Narrative B: "Balancing signal quality"
The hardest part was balancing false positives and false negatives. I introduced confidence thresholds and context-aware filtering to improve trust.

### Narrative C: "Security UX"
I treated developer trust as part of security: masked views, warning dialogs, clear exploitability language, and actionable remediation.

### Narrative D: "Operational ownership"
I designed admin endpoints so the tool is not a black box. You can inspect cache, performance, and rate behavior in production-like runs.

---

## 13. Quick Revision Sheet (Last 10 Minutes Before Interview)

- Primary endpoint: `POST /scan`
- Upload endpoint: `POST /scan/upload`
- Core files: `main.py`, `scanner.py`, `patterns.py`, `ai_fixer.py`
- Key controls: validation, rate limiting, cache, cleanup
- AI model: Gemini `gemini-2.0-flash-exp`
- Threat context classes: `EXPLOITABLE_NOW`, `BAD_PRACTICE`, `LIKELY_FALSE_POSITIVE`
- Major known fix: upload limiter method mismatch (`is_allowed` vs `check_rate_limit`)
- Best one-line value prop: "Secret detection + context-aware remediation in one workflow"

---

## 14. Do/Don’t During Real Interview

### Do

- Anchor answers to code modules.
- Admit limits and propose concrete next steps.
- Explain tradeoffs clearly.
- Show you can operate and debug, not just code.

### Don’t

- Claim benchmark numbers you cannot reproduce.
- Pretend docs are always accurate over code.
- Ignore security/privacy caveats in UI snippets.

---

## 15. Final Closing Answer

### Q114. "Why should we hire you based on this project?"
**Answer:**
This project shows I can build beyond a demo: detection logic, API design, frontend workflow, AI integration, and operational hardening. I can discuss tradeoffs honestly, identify my own gaps, and ship iterative improvements with clear ownership from design through reliability.

