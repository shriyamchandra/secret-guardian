# Secret Guardian - Comprehensive Project Knowledge Base

> Single-source reference document for answering technical, product, and architecture questions about this project.

## 1. Document Metadata

- Project name: `Secret Guardian`
- Repository path: `/Users/shriyamchandra/Desktop/secret-guardian`
- Snapshot date: February 25, 2026
- Snapshot commit: `5c05624` on branch `main`
- Primary audit basis: actual source code in `backend/` and `frontend/src/`
- Secondary context: project markdown docs in repository root

### Scope Notes

- This document prioritizes **implemented behavior in code**.
- Several root markdown files are historical/planning/interview documents. They are useful context but are not always up-to-date.
- Generated/build/runtime folders (`.git`, `.next`, `node_modules`, `venv`, `__pycache__`) are not treated as source-of-truth design docs.

---

## 2. Executive Summary

`Secret Guardian` is a full-stack security scanning application that:

- Scans public GitHub repositories by URL (`POST /scan`), and
- Scans uploaded ZIP archives (`POST /scan/upload`),
- Detects leaked secrets using:
  - built-in regex patterns,
  - entropy-informed confidence scoring,
  - optional external scanners (`gitleaks`, `trufflehog`),
- Assigns severity and threat context,
- Generates AI remediation guidance using Google Gemini,
- Returns findings in a structured JSON schema,
- Exposes admin/monitoring endpoints for cache/rate/performance visibility.

Frontend is a Next.js app with:

- landing page,
- scan page (URL mode + ZIP upload mode),
- grouped finding display by file,
- threat-context badges/details,
- AI markdown rendering with syntax highlighting,
- JSON export and summary copy.

---

## 3. What The Product Does vs Does Not Do

### Does

- Scans public GitHub repositories (cloned shallowly) for leaked credentials/secrets.
- Scans uploaded ZIP files (max 50MB) extracted into temporary directories.
- Uses 35+ regex patterns (AWS, GitHub, Google, Stripe, DB strings, JWT, keys, etc.).
- Applies confidence scoring and severity assignment.
- Optionally runs `gitleaks` and `trufflehog` when installed.
- Adds AI remediation suggestions for each finding (if `GOOGLE_API_KEY` is configured).
- Provides export endpoints for JSON and text summary.

### Does Not

- Does not require GitHub auth (current model is public URL scan or ZIP upload).
- Does not scan commit history in its current external scanner configuration (`gitleaks --no-git`, `trufflehog filesystem`).
- Does not persist scan history in database (in-memory cache only).
- Does not currently include automated tests in repo.

---

## 4. High-Level Architecture

## 4.1 Logical Flow

1. Client submits a repository URL or ZIP file.
2. Backend enforces rate limit + validation.
3. Source is cloned/extracted into temporary path.
4. Scanner runs regex engine (+ optional external scanners).
5. Findings are normalized and deduplicated.
6. Severity + threat context assigned.
7. AI suggestions are generated concurrently per finding.
8. Response returned, temporary files cleaned up.
9. URL scans are cached in memory for 1 hour.

## 4.2 Tech Stack

### Backend

- Python 3.12
- FastAPI
- Uvicorn
- Pydantic
- GitPython
- python-dotenv
- google-genai
- psutil
- python-multipart

### Frontend

- Next.js (`^16.1.4` in `package.json`)
- React 19
- TypeScript
- Tailwind CSS v4 style integration
- `react-markdown` + `remark-gfm`
- `react-syntax-highlighter`
- `lucide-react`

---

## 5. Repository Structure (Functional View)

```text
secret-guardian/
  backend/
    main.py                # FastAPI app + API contract + orchestration
    scanner.py             # Core scan pipeline, clone/extract, regex scan, dedupe
    patterns.py            # Pattern catalog + entropy + false-positive/confidence logic
    external_scanners.py   # Gitleaks/TruffleHog integration + Finding model
    ai_fixer.py            # Threat context + framework detection + Gemini prompting
    cache.py               # Thread-safe in-memory TTL cache
    rate_limiter.py        # Per-IP minute/hour limiter
    validators.py          # URL sanitization + input hardening
    performance.py         # Runtime performance metrics collection
    requirements.txt       # Backend dependencies
    .env.example           # Backend env template
    run.sh                 # Backend startup helper

  frontend/
    src/app/page.tsx                    # Landing page
    src/app/scan/page.tsx               # Main scan UI (URL + upload)
    src/app/layout.tsx                  # App metadata and root layout
    src/app/globals.css                 # Global styles
    src/components/AIResponseMarkdown.tsx   # AI markdown renderer
    src/components/SecurityEducation.tsx    # Education tooltip/modal components
    src/components/ui/button.tsx
    src/components/ui/input.tsx
    src/lib/utils.ts
    package.json
    .env.example
    vercel.json

  start.sh                 # Starts backend (bg) + frontend (fg)
  render.yaml              # Root Render blueprint (uses backend rootDir)
  DEPLOY*.md, *_SUMMARY.md # Extensive project docs and planning artifacts
```

---

## 6. Backend Deep Dive

## 6.1 API Endpoints (Implemented)

### Health and Info

- `GET /`
  - Returns API status, version, high-level stats (`total_scans`, cache hit rate, uptime).
- `GET /health`
  - Returns system metrics (`memory_mb`, `cpu_percent`, uptime) + feature flags + scanner availability.
- `GET /info`
  - Returns product capability/limitation summary and scanner availability.

### Scanning

- `POST /scan`
  - Input: JSON `{ "repo_url": "https://github.com/owner/repo" }`
  - Flow: rate limit -> URL validation -> cache lookup -> scan -> threat context -> AI suggestions -> cache set.
  - Returns findings, severity breakdown, scan duration, scanner info, `cached` metadata.

- `POST /scan/upload`
  - Input: multipart form-data with `file` (ZIP).
  - Flow: rate limit -> file checks (name/type/size) -> secure extraction -> directory scan -> threat context -> AI suggestions -> cleanup.
  - Adds metadata: `source`, `filename`, `file_size_mb`.

### Export

- `POST /export/json`
  - Input: findings payload + metadata.
  - Returns downloadable JSON file stream.

- `POST /export/summary`
  - Input: findings payload + metadata.
  - Returns text summary string for clipboard sharing.

### Admin/Monitoring

- `GET /admin/stats`
- `GET /admin/cache`
- `POST /admin/cache/clear`
- `GET /admin/rate-limits/{client_ip}`
- `POST /admin/rate-limits/reset`
- `GET /admin/performance`

## 6.2 Request/Response Core Models

### ScanRequest

- `repo_url: str` (non-empty, validated/sanitized)

### ExportRequest

- `findings: list`
- `repo_url: str`
- `scan_duration: float`
- `severity_breakdown: dict`

### Finding (normalized model)

From `external_scanners.Finding`:

- `secret_type`
- `file_path`
- `line_number`
- `confidence`
- `entropy`
- `raw_value` (masked)
- `severity`
- `scanner_source`
- optional metadata (`description`, `commit_hash`, `author`, `code_snippet`, `language`, `leaked_line`)

Additional fields attached downstream:

- `threat_context`
- `ai_fix`

## 6.3 Scanning Engine Behavior (`scanner.py`)

### Limits and Defaults

- Scan timeout default: 300s
- Max file size scanned: 1MB/file
- Max files scanned: 5000 files
- Clone strategy: shallow clone (`depth=1`, `single_branch=True`)

### File/Directory Exclusions

- Skips binary/media/build artifacts (`.png`, `.pdf`, `.zip`, `.pyc`, `.lock`, minified assets, etc.)
- Skips directories like `.git`, `node_modules`, `venv`, `dist`, `build`, `__pycache__`, etc.

### Detection Pipeline

1. Regex scanner runs across eligible files.
2. Confidence score computed per match.
3. LOW-confidence findings are dropped.
4. Entropy computed per detected secret token.
5. Severity derived from secret type/confidence/entropy.
6. Optional external scanners run if installed.
7. Findings deduplicated across scanners.
8. Results sorted by severity/file/line.

## 6.4 Pattern and Scoring Logic (`patterns.py`)

### Pattern Coverage

Includes patterns for:

- AWS, OpenAI, GitHub token families, Google, Stripe,
- Slack, Twilio, SendGrid, Mailgun, Square, PayPal, Heroku,
- private key headers (RSA/SSH/PGP), DB connection strings,
- JWT, generic API key/secret, bearer token.

### Entropy

- Shannon entropy used (`calculate_shannon_entropy`).
- Generic/high-risk heuristics depend on entropy thresholds.

### False Positive Filtering

- Placeholder and example heuristics (`example`, `test`, `dummy`, etc.).
- Pure variable placeholder patterns (`${VAR}`, `{{VAR}}`).

### Confidence Scoring

Factors include:

- Pattern specificity,
- file path context (`.env`/config boosts, test/spec/mock lowers),
- false-positive indicators,
- entropy checks for generic patterns.

Output: `HIGH`, `MEDIUM`, `LOW` + numeric score.

## 6.5 External Scanners (`external_scanners.py`)

- `gitleaks` integration:
  - command includes `--no-git` (filesystem-like scan only).
- `trufflehog` integration:
  - uses `trufflehog filesystem --directory ... --json --no-update`.
- Both results normalized to common `Finding` schema.
- Severity fallback logic applied when scanner-specific labels differ.

## 6.6 Threat Context + AI Remediation (`ai_fixer.py`)

### Threat Context Analysis

Classifies exploitability into:

- `EXPLOITABLE_NOW`
- `BAD_PRACTICE`
- `LIKELY_FALSE_POSITIVE`

Considers:

- dev/localhost indicators,
- test/example filename patterns,
- placeholder patterns,
- secret type sensitivity,
- entropy signal.

### Framework Detection Heuristics

Maps finding context to likely framework:

- Spring Boot, Node.js, Next.js/React, Django, Flask, .NET, Go, Ruby/Rails, Generic.

### Gemini Integration

- API key env: `GOOGLE_API_KEY`
- Model: `gemini-2.0-flash-exp`
- Params: temperature `0.3`, max output tokens `2000`
- Generates calibrated remediation report + includes threat context payload.

If unavailable, returns error payload rather than crashing.

## 6.7 Support Systems

### Cache (`cache.py`)

- Thread-safe in-memory TTL cache (default 3600s).
- Keying: SHA-256(repo_url) truncated to 16 hex chars.
- Tracks hits, misses, hit rate.

### Rate Limiter (`rate_limiter.py`)

- Per-IP sliding-window style buckets.
- Defaults:
  - 10 requests/minute
  - 100 requests/hour
- Returns retry hints for throttled requests.

### Validators (`validators.py`)

- Accepts only GitHub URL formats (`https://...`, `.git`, `git@github.com:...`).
- Blocks dangerous patterns (traversal, command chaining, script tags, etc.).
- Sanitizes to canonical HTTPS URL.

### Performance Monitor (`performance.py`)

- Tracks per-scan duration, CPU, memory delta, findings count.
- Maintains aggregated metrics + recent scans.

---

## 7. Frontend Deep Dive

## 7.1 Pages

- `/` (`frontend/src/app/page.tsx`)
  - Marketing/overview page with feature blocks and CTA to scan.

- `/scan` (`frontend/src/app/scan/page.tsx`)
  - Main operational page.
  - Two scan modes:
    - GitHub URL
    - ZIP upload (drag/drop + file picker)

## 7.2 Scan Page State Model

Key state variables:

- `repoUrl`, `scanMode`, `uploadedFile`
- `loading`, `progress`, `error`
- `scanResult`
- `copiedKey`
- `revealedSecrets`, `showRevealWarning`

Key actions:

- `handleScan()` -> `POST /scan`
- `handleUploadScan()` -> `POST /scan/upload`
- `exportJSON()` -> `POST /export/json`
- `copySummary()` -> `POST /export/summary`

## 7.3 Findings Presentation

- Findings grouped by `file_path`.
- Each finding displays:
  - severity, line, secret type, confidence, entropy, scanner source,
  - threat context badge/details,
  - code snippet block,
  - detected value section,
  - AI recommendation markdown panel.

## 7.4 AI Markdown Rendering Component

`AIResponseMarkdown.tsx` features:

- `react-markdown` + `remark-gfm`
- custom renderers for headings, code, tables, lists, blockquotes, links
- syntax highlighting using Prism `oneDark`
- section-icon heuristics based on heading text.

## 7.5 UI Components and Utilities

- `Button` component with variants/sizes.
- `Input` component with consistent styling.
- `cn()` utility: class-name concatenation helper.

---

## 8. Security and Privacy Model

### Intended controls in implementation

- temporary clone/extraction directories
- cleanup in `finally` blocks
- masked `raw_value` in finding payloads
- input sanitization and rate limits
- scan-only behavior (no file modifications)

### Important caveat

- Even though `raw_value` is masked, `code_snippet`/`leaked_line` may still include visible secret text as scanned from source files.
- This means "masked-by-default" is only partially true in current implementation and should be treated carefully.

---

## 9. Configuration and Environment Variables

## 9.1 Backend Environment Variables

- `GOOGLE_API_KEY` (required for AI suggestions)
- `FRONTEND_URL` (used for CORS in production)
- `RENDER` (checked to allow wildcard CORS fallback when frontend URL missing)

From `.env.example`, optional commented settings are documented but not wired in code for dynamic override:

- `RATE_LIMIT_PER_MINUTE`
- `RATE_LIMIT_PER_HOUR`
- `CACHE_TTL`
- `SCAN_TIMEOUT`

## 9.2 Frontend Environment Variables

- `NEXT_PUBLIC_API_URL` (base URL for backend API calls)

---

## 10. Run and Deployment Workflows

## 10.1 Local Development

### One command

- `./start.sh` from repo root:
  - prepares/starts backend in background,
  - ensures frontend deps,
  - starts frontend dev server in foreground.

### Manual

- Backend:
  - `cd backend`
  - `source venv/bin/activate`
  - `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- Frontend:
  - `cd frontend`
  - `npm install`
  - `npm run dev`

## 10.2 Deployment Artifacts

- Root `render.yaml`: deploy backend from `rootDir: backend`, env var `GOOGLE_API_KEY`.
- `frontend/vercel.json`: Next.js config + security headers.
- Root/aux docs recommend Vercel (frontend) + Render (backend).

---

## 11. Known Issues and Inconsistencies (Important)

1. Upload rate-limit method mismatch:
   - `main.py` upload endpoint calls `rate_limiter.is_allowed(...)`.
   - `RateLimiter` class exposes `check_rate_limit(...)`.
   - Result: ZIP upload path may error unless method is fixed.

2. Env var mismatch in deployment blueprints:
   - Root `render.yaml` uses `GOOGLE_API_KEY` (matches code).
   - `backend/render.yaml` uses `GEMINI_API_KEY` (does not match code expectation).

3. Masking claim vs UI behavior:
   - `raw_value` masked, but snippet content can still reveal secrets.
   - Reveal/hide controls apply primarily to `raw_value` display, not entire snippet visibility.

4. Font configuration conflict:
   - Layout sets Inter font variable,
   - global CSS forces `Arial, Helvetica, sans-serif`, overriding intended font stack.

5. Version/document drift:
   - Some docs mention Next.js 14/15; current `frontend/package.json` has Next.js `^16.1.4`.
   - Multiple summary/roadmap docs include aspirational claims or historical numbers.

6. No automated test suite present in repository source:
   - No backend `tests/` or frontend test config currently included.

7. Root `start.sh` suppresses backend logs (`> /dev/null 2>&1`):
   - simplifies console output but hinders debugging unless changed.

---

## 12. Operational Limits (from code)

- URL scan timeout: 300s default
- Upload size limit: 50MB ZIP
- Max scanned file size: 1MB/file
- Max scanned file count: 5000 files
- Rate limit: 10/min and 100/hour per IP
- Cache TTL: 1 hour

---

## 13. Q&A Bank (Project Interview / Handover Ready)

### Product and Scope

Q1. What problem does Secret Guardian solve?
A. It detects leaked credentials/secrets in code and provides remediation guidance.

Q2. What inputs does it support?
A. Public GitHub repo URLs and local ZIP uploads.

Q3. Does it support private GitHub repos directly?
A. Not via URL scan in v1; ZIP upload can scan private code snapshots.

Q4. Does it require GitHub authentication?
A. No.

Q5. Does it modify user repositories?
A. No, scanning is read-only.

### Detection Engine

Q6. How are secrets detected?
A. Regex patterns + confidence scoring + entropy + optional external scanners.

Q7. How many secret categories are covered?
A. 35+ patterns in `patterns.py`.

Q8. What is entropy used for?
A. To estimate randomness and improve detection of likely real secrets, especially generic patterns.

Q9. How are false positives reduced?
A. Placeholder/test/example heuristics and confidence scoring.

Q10. How is severity decided?
A. By secret type mapping plus confidence/entropy fallback logic.

Q11. Are scanner outputs normalized?
A. Yes, normalized to a shared `Finding` schema.

Q12. How are duplicate findings handled?
A. Dedup by `(file_path, line_number, normalized_secret_type)` with severity/context preference.

### AI and Threat Modeling

Q13. What AI model is used?
A. Gemini `gemini-2.0-flash-exp` via `google-genai` SDK.

Q14. What does AI output include?
A. Risk explanation, actions, secure coding pattern, config guidance, framework-specific advice.

Q15. How is threat urgency calibrated?
A. Findings are tagged as exploitable now vs bad practice vs likely false positive based on context indicators.

Q16. What if Gemini key is missing?
A. `ai_fix` returns an error payload rather than suggestion text.

### API and Runtime

Q17. What is the primary endpoint for scanning URLs?
A. `POST /scan`.

Q18. How does caching work?
A. In-memory TTL cache keyed by hash of repo URL, default 1 hour.

Q19. What rate limits are enforced?
A. 10 req/min and 100 req/hour per IP.

Q20. Where can we inspect runtime stats?
A. `GET /admin/stats`, `GET /admin/cache`, `GET /admin/performance`.

Q21. What response exports are available?
A. Downloadable JSON report and copyable text summary.

### Security and Ops

Q22. Is scanned code stored?
A. It is processed in temporary directories and cleaned up; no DB persistence implemented.

Q23. Are all secrets fully masked in UI?
A. Not fully; raw values are masked, but snippets may still expose secrets.

Q24. What are the biggest current reliability risks?
A. Upload endpoint rate-limit method mismatch and config drift across deployment files.

Q25. Is this production deployable as-is?
A. Mostly yes for core URL scan path; ZIP upload bug and config inconsistencies should be fixed first.

### Frontend

Q26. Which page holds the scanning workflow?
A. `frontend/src/app/scan/page.tsx`.

Q27. How does frontend call backend?
A. Using `fetch` to `${process.env.NEXT_PUBLIC_API_URL}` endpoints.

Q28. How are AI responses shown?
A. Markdown-rendered component with syntax highlighting (`AIResponseMarkdown`).

Q29. Can users export findings?
A. Yes, JSON download and summary clipboard copy.

Q30. Is frontend type-safe?
A. TypeScript is enabled (`strict: true`), with typed local models for scan results/findings.

---

## 14. Suggested Next Engineering Priorities

1. Fix `POST /scan/upload` rate-limit call (`is_allowed` -> `check_rate_limit`).
2. Unify deployment env var names (`GOOGLE_API_KEY` everywhere).
3. Align masking strategy so snippets do not leak full secret values by default.
4. Add baseline automated tests:
   - backend endpoint + scanner unit tests,
   - frontend component/rendering smoke tests.
5. Add structured logging + error observability for production.

---

## 15. Quick Onboarding Checklist (New Maintainer)

1. Set backend `.env` with valid `GOOGLE_API_KEY`.
2. Set frontend `.env.local` with `NEXT_PUBLIC_API_URL`.
3. Run backend and frontend locally.
4. Verify `GET /health` and `GET /info`.
5. Test URL scan path with a known repo.
6. Test upload path (after rate-limit method fix).
7. Confirm export endpoints and threat-context rendering.

---

## 16. Source-of-Truth Priority Order

When answering future questions, use this precedence:

1. Actual code in `backend/*.py` and `frontend/src/**/*`
2. Runtime config files (`*.env.example`, `render.yaml`, `vercel.json`)
3. Root README
4. Historical summary/roadmap markdown files

This avoids confusion from historical documents that may contain outdated claims.

---

## 17. Final One-Paragraph Project Description

Secret Guardian is a FastAPI + Next.js application for scanning repositories and uploaded code archives for leaked secrets. It combines a regex-based detection engine, entropy-informed confidence scoring, optional external scanner integration, and context-aware threat modeling to surface prioritized findings, then generates AI remediation guidance using Google Gemini. The frontend provides a detailed grouped findings UI with threat badges, markdown-rendered recommendations, and export tools, while the backend includes caching, rate limiting, validation, and performance monitoring endpoints.

