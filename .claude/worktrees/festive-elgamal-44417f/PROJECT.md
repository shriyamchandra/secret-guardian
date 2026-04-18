# Secret Guardian: Comprehensive Codebase Master Document

This document is the exhaustive, definitive guide to the Secret Guardian repository. It is designed so that a developer who has never seen the codebase can fully understand, navigate, and maintain the system purely from reading this file. It meticulously covers the architecture, data flow, component interfaces, operational constraints, and domain logic.

---

## 1. Project Overview

### What this project does, why it exists, and what problem it solves
Secret Guardian is an advanced, standalone security scanning tool designed to aggressively detect accidentally leaked credentials (API keys, database strings, cloud tokens) within public GitHub repositories and zipped code archives. 

It solves a critical industry problem: **False Positives and "Alert Fatigue."** Traditional scanners simply use regex to blindly flag test strings like `your_api_key_here` or `localhost`, causing developers to ignore alerts entirely. Furthermore, when a real secret *is* found, developers frequently don't understand how to securely rotate it or implement environmental variable best practices for their specific framework.

Secret Guardian bridges this gap by combining:
1. **Mathematical Scanning:** Using Shannon Entropy analysis to find unknown, zero-day cryptographic strings.
2. **Context-Aware Threat Modeling:** Analyzing the surrounding code to determine if an alert is "Exploitable" or just a "Bad Practice".
3. **AI-Powered Remediation:** Using Google Gemini to automatically generate framework-specific markdown code blocks showing the developer exactly how to implement secure `.env` architectures.

### Tech Stack and Justification
- **Backend (Python 3.12, FastAPI, Pydantic):** Chosen because Python excels at string processing, regex curation, and mathematical operations (entropy). FastAPI provides highly performant asynchronous IO capabilities which are critical when waiting on external LLM calls or filesystem operations.
- **Frontend (Next.js 15, React 19, Tailwind CSS):** Chosen for Server-Side Rendering capabilities, strict TypeScript interfaces that match Pydantic schemas, and robust component architecture needed for rendering syntax-highlighted markdown.
- **AI Integration (Google Gemini API):** Chosen for its massive context window and fast inference specifically on programmatic coding logic.
- **Scanning Engines (GitPython, Custom Regex, Gitleaks, TruffleHog):** A layered approach ensuring no credential structure slips through.

### High-Level Architecture
1. **Client Request:** The Next.js UI sends an asynchronous POST to the FastAPI backend containing a URL or ZIP binary.
2. **Sandbox Ingestion:** FastAPI runs Token Bucket rate limiting, checks an SHA-256 caching ring, and if a miss occurs, clones the repo to an ephemeral `/tmp` directory.
3. **Execution Engine:** The Python concurrency pool runs standard File I/O regex alongside external subprocess binaries (Gitleaks).
4. **Data Deduplication:** Findings generated across different engines are coalesced.
5. **AI Orchestrator:** The backend computes the "Threat Context" for each finding. High-risk items query Gemini in parallel with a hard budget limit.
6. **Egress:** The massive JSON response is normalized, heavily masked to prevent API text leaks, cached, and the filesystem sandbox is instantly destroyed.

---

## 2. Folder & File Structure

### Root Operations
- `/start.sh` & `/run.sh`: Master execution scripts to concurrently boot Uvicorn (backend) and Next.js (frontend) servers locally.
- `README.md`: The lightweight public landing document.
- `PROJECT.md`: This file.

### Backend (`/backend`)
Handles API routing, file extraction, scanning algorithms, and AI orchestration.
- `main.py`: The FastAPI application entry point. Wires up routers, CORS, global exception handlers, and base `/health` endpoints.
- `scanner.py`: The pipeline orchestrator. Handles repository cloning, controls scan timeouts, executes directory walks, and forcefully cleans up temporary directories.
- `patterns.py`: Home of the `SECRET_PATTERNS` regex dictionaries, Shannon entropy math functions, and false-positive algorithmic checks.
- `ai_fixer.py`: The Artificial Intelligence bridge. Implements the `ThreatContext` heuristic logic to frame Prompts for Gemini. Also handles fallback remediation routing.
- `external_scanners.py`: Subprocess wrappers that bind the Python backend to `gitleaks` and `trufflehog` binaries installed on the host. Implements the `Finding` dataclass and merging logic.
- `cache.py`: Provides in-memory TTL caching mechanisms.
- `rate_limiter.py`: Implements mathematical sliding window/token bucket limiting.
- `performance.py`: Hooks to record API scan times, CPU loads, and payload throughput.
- `/api/`: Contains segmented HTTP routers (`routes_scan.py`, `routes_scan_repo.py`, `routes_scan_upload.py`, `routes_admin.py`).

### Frontend (`/frontend`)
The presentation layer built on App Router.
- `package.json`: NPM package mapping, notably leveraging `react-markdown` and `lucide-react`.
- `tailwind.config.ts`: Base design tokens.
- `/src/app/page.tsx`: Landing user hero page UI.
- `/src/app/scan/page.tsx`: The core visual engine. Responsible for iterating over API JSON results, expanding accordions, toggling "Reveal" functionality, and presenting Markdown of AI recommendations.
- `/src/components/`: Reusable strict UI atoms (Badges, Buttons, Skeleton loaders).

*What to ignore:* Directories like `.next/`, `node_modules/`, `venv/`, `__pycache__/` are dynamically generated environment artifacts. Never modify these.

---

## 3. Core Concepts & Domain Logic

### Shannon Entropy Mathematics
Randomness is the strongest indicator of a cryptographic secret. We use the formula `H(X) = -Σ p(x) * log₂(p(x))`.
- **Business Rule:** If a generic API string lacks a known structure, but its entropy exceeds `4.5` (a highly random distribution of characters), the system forces a `HIGH` severity scan classification.

### The Zero-Trust Masking Model
A security tool that leaks the very secrets it found across the network defeats its purpose.
- **Constraint:** `raw_value` and `code_snippet` inside the JSON payload are irreversibly masked by backend algorithms to show only `AKIA****WXYZ`.
- **Mental Model:** Only when the user visually confirms a warning prompt on the frontend does an interface state unlock to show the raw secret.

### Threat Context and AI Budgeting
LLMs are financially and temporally expensive. 
- **Non-Obvious Decision:** We do **not** query Gemini for every secret. The `SmartAIOrchestrator` heavily parses the surrounding line strings for variables like `localhost`, `mock`, or string templates like `${MY_VAR}`. If it's deemed a `LIKELY_FALSE_POSITIVE`, AI calls are aborted, and the payload receives a deterministic, hardcoded fallback string seamlessly.
- **Budgeting Limit:** `MAX_AI_CALLS_PER_SCAN` is hardcoded to `5` to prevent cascading timeouts on massive repositories heavily laden with credential debris.

---

## 4. Data Flow & State Management

**System Entry:** 
The user pastes a GitHub URL or drops a ZIP via `src/app/scan/page.tsx`. React state `isScanning` turns `true`. Fast-polling begins.

**Data Transformation Pipeline:**
1. FastAPI `POST /api/scan` receives `{"repo_url": "..."}`.
2. `scanner.scan_repo()` clones the repo into a randomly generated `$TMPDIR`.
3. An array `all_findings: List[Finding]` is sequentially mutated:
   - Appended to by `run_regex_scanner()` (Python memory IO).
   - Appended to by `run_gitleaks()` (Subprocess JSON output parsing).
4. `deduplicate_findings(all_findings)` squashes the list using a `(file_path, line_number, secret_type)` unified tuple key to prevent duplicate badges from different engines.
5. In `ai_fixer.py`, `run_ai_remediation()` mutates the dictionary objects via `asyncio`, appending the huge `"ai_fix"` Markdown dictionary to each finding.
6. The entire state is bundled into a master response object and compressed across the HTTP wire.

**Frontend State Management:**
- `findings` array state is loaded. 
- Elements rely on component-level `useState` hooks to dictate whether an accordion (`FileGroup`) is collapsed or expanded. 
- `unmaskedSecrets: Record<string, boolean>` object dictates if the user has unlocked the UI masking for a specific finding index.

---

## 5. Every Module / Component / Class / Function Deep Dive

### `backend/scanner.py`
- `scan_repo(repo_url, timeout, ...)` -> `Dict[str, Any]`
  - *Does:* Orchestrates URL cloning, calls directory scanner, handles sweeping `rmtree` cleanup on success/fail constraint.
  - *Edge Handling:* Intercepts `FuturesTimeoutError` throwing 500 cleanly avoiding zombie disk footprint.
- `scan_directory(dir_path)` -> `Dict`
  - *Does:* Aggregates the 3 engines and calculates aggregate metrics (`files_affected`, `scan_duration`).
- `run_regex_scanner(repo_path)` -> `List[Finding]`
  - *Does:* Walks file trees line-by-line comparing to `SECRET_PATTERNS`.
  - *Side Effect:* Reads hundreds of files into memory linearly. Limited by `MAX_FILE_SIZE`.
- `has_real_google_service_account_context(lines, index)` -> `bool`
  - *Does:* Specific heuristic looking +/- 25 lines for `"client_email"` flags to prevent over-eager matching of `"type": "service_account"` documentation lines.

### `backend/patterns.py` (Math & Regex Engine)
- `SECRET_PATTERNS`: Dict pairing string keys (e.g., `"AWS Access Key"`) to pre-compiled `re.compile()` objects.
- `calculate_shannon_entropy(data: str)` -> `float`
  - *Does:* Returns randomness score.
- `calculate_confidence_score(secret_type, matched_text, line, file)` -> `Tuple[str, float]`
  - *Does:* A weighted multiplier. Starts at `1.0`. `file=.env` (1.0 * 1.3). `line=mock_data` (X * 0.4). Output is categorized HIGH, MEDIUM, LOW.
- `is_likely_false_positive(text, context)` -> `bool`
  - *Does:* A critical boolean gate checking for hardcoded `xxx`, `000`, `YOUR_KEY`, or `${VARIABLES}` representing non-threats.

### `backend/external_scanners.py` (Subprocess Bridges)
- `class Finding` (Dataclass)
  - *Properties:* `secret_type`, `file_path`, `line_number`, `confidence`, `entropy`, `raw_value`, `severity`, `scanner_source`, `code_snippet`, `leaked_line`.
- `run_gitleaks(repo_path)` -> `List[Finding]`
  - *Does:* Executes `subprocess.run(["gitleaks", "detect", "--no-git"])`. Reads output JSON, mapping its specific keys back to the standard `Finding` dataclass.
- `deduplicate_findings(findings: List[Finding])` -> `List[Finding]`
  - *Does:* Merges finding tuples. Returns the instance mathematically possessing the highest `Severity` enum, gracefully tossing the lesser.

### `backend/ai_fixer.py` (The Intelligence Layer)
- `class ThreatContext`
  - *Properties:* Holds static Lists like `DEV_INDICATORS`, `TEST_FILE_PATTERNS`, `HIGH_EXPLOITABILITY_TYPES`.
- `analyze_threat_context(finding)` -> `Dict`
  - *Does:* Produces `EXPLOITABLE_NOW`, `BAD_PRACTICE`, or `LIKELY_FALSE_POSITIVE`. Emits mitigating/risk factors array.
- `get_framework_specific_advice(framework, type)` -> `str`
  - *Does:* Hardcoded deterministic string mappings. (e.g., Spring Boot returns `application.properties` advice). Fast, zero AI cost.
- `get_gemini_fix(finding)` -> `Dict`
  - *Does:* Formats the 5-part AI prompt incorporating Entropy and the raw snippet. Calls `google-genai` client.
  - *Edge Handling:* Catches HTTP 429 Limit, raises explicit `_terminal_error: True` flag.
- `run_ai_remediation(findings)` -> `Dict`
  - *Does:* Loops the finding arrays dynamically via `asyncio`. Holds the `circuit_broken=True` state to immediately shift to deterministic responses if quota fails.

---

## 6. APIs & Interfaces

### Internal Schemas
- `POST /api/scan`:
  - **Params:** `{"repo_url": "URL_STRING"}`
  - **Headers:** Rate limiter `Forwarded-For`.
  - **Yields:** `dict` holding `findings: [...]`, `total_findings: int`, `severity_breakdown: {...}`, `has_critical: bool`.
  - **Errors:** 422 Unprocessable if URL fails regex. 500 if cloning times out.

- `POST /api/scan/upload`:
  - **Method:** `multipart/form-data`
  - **Params:** `file` byte stream. Hard-capped at 50MB. Max extraction file constraints.
  - **Yields:** Exact same unified JSON format as URL `POST /api/scan`.

---

## 7. Configuration Options

All settings are primarily driven via ENV injection in `/backend/.env`.

- `GOOGLE_API_KEY`: string. Mandatory for generating Markdown AI reports.
- `GEMINI_MODEL`: string. Target LLM node. Default: `gemini-2.0-flash`.
- `MAX_AI_CALLS_PER_SCAN`: integer. Ceiling limit of LLM dispatches per API call. Default `5`.
- `AI_CALL_TIMEOUT`: integer. Seconds to wait for Google before short-circuit fallback. Default `30`.
- `FRONTEND_URL`: string. Localhost port vs Production URL overriding CORS.

---

## 8. Setup & Running the Project

### Baseline Boot (Blank Machine)
1. Require Python 3.12+ and Node 18+.
2. Download and Extract source.
3. Open Terminal 1:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   touch .env # And inject GOOGLE_API_KEY=xxx
   uvicorn main:app --reload --port 8000
   ```
4. Open Terminal 2:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Operational Errors
- **Gitleaks Warning:** On boot, FastApi checks PATH for `gitleaks` and `trufflehog`. If they are missing, it simply prints a warning flag and downgrades to the pure Python regex engine smoothly. Fix with `brew install gitleaks`.
- **CORS Conflict:** If scanning an API request via cURL returns correctly, but the React UI errors blindly with "Network Error", the `origins` list in `main.py` is misconfigured. Verify `FRONTEND_URL`.

---

## 9. Testing Strategy

1. **Frontend Isolation:** Since Next.js just parses JSON inputs, tests can easily mock API returns. The standard Next.js unit tests rely on pre-compiled strict TS interfaces identical to Pydantic returns.
2. **Detection Engine Tests:** The ideal way to assert pattern strength is by dumping fake JWTs (`eyJ...`), fake AWS (`AKIA...`), and fake `localhost:6379` entries into locally tracked files, uploading them as a ZIP stream to `/scan/upload`, and verifying the `ThreatContext` output correctly identifies them as Exploitable vs Bad Practice without triggering live LLM requests.

---

## 10. Known Quirks, Gotchas, and Workarounds

### Time-of-Check to Time-of-Use (TOCTOU)
Security scanners create numerous temporary files. Originally standard `tempfile.mktemp()` was used for `Gitleaks` output JSON. This was rapidly patched to use `NamedTemporaryFile(delete=False)` because modern Linux kernels permit atomic concurrent creation locks. A new developer trying to revert this for "cleaner paths" will inadvertently reintroduce systemic race conditions if user volume bursts simultaneously.

### Zip Bombs & Streaming Limits
Do not touch the chunked zip `extractall()` methodology. Using vanilla zip loaders opens the server to 50GB uncompressed memory balloons and `../../` directory traversal attacks. The extraction streams in hardcoded 64KB blocks to enforce the 200MB maximum boundary exactly and immediately aborts connections upon limits.

### Memory Overhead During Burst Parsing
If reading ultra-minified bundle files (`webpack.js`), standard newline arrays explode Python's memory footprint. A new developer might wonder why `.min.js` and `.lock` files are hardcoded in `SKIP_DIRS` or `BINARY_EXTENSIONS` arrays. This is an explicit tech debt workaround protecting the O(N) scanning loop throughput.

### "Why did you ignore the depth history tree?"
This tool assumes an API endpoint speed restriction of max 300 seconds. Iterating a 100,000 deep `git commit` history takes hours. Deeply scanning history was explicitly ignored to favor realtime surface-level analysis, shallow-cloned via `depth=1` to dramatically slim I/O operations.
