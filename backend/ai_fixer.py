"""
AI-Powered Remediation Engine with Context-Aware Threat Modeling

Uses Google Gemini to provide comprehensive security recommendations:
- Explains what the secret is and why it's risky
- Provides immediate actions (rotate/revoke)
- Suggests long-term fixes (env vars, secret managers)
- Framework-aware suggestions (Spring Boot, Node.js, Django, etc.)

CRITICAL: Context-aware threat modeling to distinguish between:
- "Exploitable Now" - Production secrets that need immediate rotation
- "Bad Practice" - Development/localhost credentials that should be fixed but aren't critical
- "False Positive" - Example values, placeholders, or test fixtures
"""

import os
import re
import copy
import hashlib
from typing import Dict, Any, List, Optional, Callable

from dotenv import load_dotenv


_here = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_here, ".env")
load_dotenv(dotenv_path=_env_path, override=False)

try:
    from google import genai
    from google.genai import types
except Exception:
    genai = None
    types = None

try:
    from qwen_fixer import get_qwen_fix, is_qwen_available, QWEN_TIMEOUT as _QWEN_TIMEOUT
except Exception:
    get_qwen_fix = None  # type: ignore
    is_qwen_available = lambda: False  # type: ignore
    _QWEN_TIMEOUT = 120


API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


# ==============================================================================
# CONTEXT-AWARE THREAT MODELING
# ==============================================================================


class ThreatContext:
    """Determines real-world exploitability of a finding."""

    # Patterns indicating development/local environment (lower risk)
    DEV_INDICATORS = [
        r"localhost",
        r"127\.0\.0\.1",
        r"0\.0\.0\.0",
        r"test",
        r"spec",
        r"mock",
        r"fake",
        r"dummy",
        r"example",
        r"sample",
        r"demo",
        r"fixture",
        r"dev",
        r"development",
        r"staging",
        r"sandbox",
        r"__test__",
        r"__tests__",
        r"__mocks__",
    ]

    # File path patterns indicating test/example files
    TEST_FILE_PATTERNS = [
        r"test[_\-]?",
        r"_test\.",
        r"\.test\.",
        r"spec[_\-]?",
        r"_spec\.",
        r"\.spec\.",
        r"mock",
        r"fixture",
        r"example",
        r"sample",
        r"demo",
        r"template",
        r"\.example",
        r"\.sample",
        r"\.template",
        r"README",
        r"EXAMPLE",
        r"docs/",
        r"documentation/",
    ]

    # Placeholder values that aren't real secrets
    PLACEHOLDER_PATTERNS = [
        r"^your[_\-]?",
        r"^my[_\-]?",
        r"^xxx+",
        r"^placeholder",
        r"^insert[_\-]?",
        r"^change[_\-]?me",
        r"^todo",
        r"^replace[_\-]?",
        r"^enter[_\-]?",
        r"<.*>",
        r"%.*%",
        r"^sk[_\-]?test",
        r"^pk[_\-]?test",  # Stripe test keys
        r"^AKIA[A-Z0-9]{12}EXAMPLE",  # AWS example key format
    ]

    # Secret types with high exploitability (can be used immediately)
    HIGH_EXPLOITABILITY_TYPES = [
        "aws",
        "gcp",
        "azure",
        "stripe",
        "paypal",
        "twilio",
        "sendgrid",
        "github",
        "gitlab",
        "npm",
        "pypi",
        "docker",
        "ssh",
        "jwt",
        "oauth",
        "bearer",
    ]

    # Secret types that are context-dependent
    CONTEXT_DEPENDENT_TYPES = [
        "database",
        "mysql",
        "postgres",
        "mongodb",
        "redis",
        "api_key",
        "password",
        "secret_key",
    ]


def analyze_threat_context(finding: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze the finding to determine real-world exploitability.

    Returns:
        {
            "risk_level": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
            "exploitability": "EXPLOITABLE_NOW" | "BAD_PRACTICE" | "LIKELY_FALSE_POSITIVE",
            "context_notes": ["list of context observations"],
            "confidence": 0.0-1.0,
            "recommended_action": "ROTATE_NOW" | "FIX_WHEN_POSSIBLE" | "REVIEW" | "IGNORE"
        }
    """
    file_path = str(finding.get("file_path") or "").lower()
    code_snippet = str(
        finding.get("code_snippet") or finding.get("leaked_line") or ""
    ).lower()
    secret_type = str(finding.get("secret_type") or "").lower()
    severity = str(finding.get("severity") or "HIGH")
    noise_type = str(finding.get("noise_type") or "").upper()
    try:
        entropy = float(finding.get("entropy", 0) or 0)
    except (TypeError, ValueError):
        entropy = 0.0

    context_notes = []
    risk_factors = []
    mitigating_factors = []

    # === Honor upstream heuristic noise grading ===
    # Heuristics already did strict path + value analysis. If a finding was tagged
    # as fixture/documentation/test noise, we must not escalate it to EXPLOITABLE_NOW.
    FIXTURE_NOISE_TYPES = {"FIXTURE_DATA", "FIXTURE_VALUE", "DOCUMENTATION_TEMPLATE"}
    TEST_NOISE_TYPES = {"TEST_FIXTURE"}

    if noise_type in FIXTURE_NOISE_TYPES:
        return {
            "risk_level": "INFO",
            "exploitability": "LIKELY_FALSE_POSITIVE",
            "context_notes": [
                "✅ Heuristic flagged as fixture/placeholder — not an exploitable secret.",
                f"📁 File path / value matched noise class: {noise_type}",
            ],
            "confidence": 0.8,
            "recommended_action": "REVIEW",
            "risk_factors": [],
            "mitigating_factors": [f"Upstream heuristic: {noise_type}"],
        }

    # === Check for development/localhost indicators ===
    for pattern in ThreatContext.DEV_INDICATORS:
        if re.search(pattern, code_snippet, re.IGNORECASE):
            mitigating_factors.append(f"Contains development indicator: '{pattern}'")
            context_notes.append(
                f"🔍 Detected development/localhost indicator: '{pattern}'"
            )

    # === Check for test file patterns ===
    matched_test_pattern = None
    for pattern in ThreatContext.TEST_FILE_PATTERNS:
        if re.search(pattern, file_path, re.IGNORECASE):
            matched_test_pattern = pattern
            # Test file paths are a dominant mitigating signal — count twice so a
            # single high-value secret type cannot flip the finding to EXPLOITABLE_NOW.
            mitigating_factors.append(
                f"File appears to be test/example: '{pattern}' (dominant)"
            )
            mitigating_factors.append(
                "Test fixtures are intentionally planted and non-exploitable"
            )
            context_notes.append("📁 File path strongly suggests test/example file")
            break

    # The upstream heuristic also marks *_test.* files as TEST_FIXTURE noise.
    # When we see that tag, treat the test-file signal as even stronger.
    if noise_type in TEST_NOISE_TYPES and not matched_test_pattern:
        mitigating_factors.append("Upstream heuristic marked TEST_FIXTURE (dominant)")
        mitigating_factors.append("Test fixtures are intentionally planted")
        context_notes.append("📁 Heuristic flagged this file as test/fixture")
        matched_test_pattern = "noise_type:TEST_FIXTURE"

    # === Check for placeholder values ===
    for pattern in ThreatContext.PLACEHOLDER_PATTERNS:
        if re.search(pattern, code_snippet, re.IGNORECASE):
            mitigating_factors.append(f"Value appears to be placeholder: '{pattern}'")
            context_notes.append(
                "📝 Value appears to be a placeholder, not a real secret"
            )
            break

    # === Advanced Variable Template Logic ===
    if re.search(
        r"=['\"]?(?:\$\{[A-Za-z0-9_]+\}|\{\{[A-Za-z0-9_]+\}\})['\"]?(\s|$)",
        code_snippet,
        re.IGNORECASE,
    ):
        mitigating_factors.append("Value is purely a templated environment variable")
        context_notes.append(
            "📝 Value is a pure environment variable placeholder (e.g., ${VAR})"
        )
    else:
        # Check for ${VAR:default_value} fallback leaks
        default_match = re.search(r"\$\{[A-Za-z0-9_]+:([^}]+)\}", code_snippet)
        if default_match:
            default_val = default_match.group(1).strip()
            from patterns import calculate_shannon_entropy

            default_entropy = calculate_shannon_entropy(default_val)

            is_dummy = any(
                re.search(p, default_val, re.IGNORECASE)
                for p in ThreatContext.DEV_INDICATORS
            )
            is_placeholder = any(
                re.search(p, default_val, re.IGNORECASE)
                for p in ThreatContext.PLACEHOLDER_PATTERNS
            )

            if (
                (default_entropy > 3.5 or len(default_val) > 15)
                and not is_dummy
                and not is_placeholder
                and " " not in default_val
            ):
                risk_factors.append(
                    "Template default value appears to be a real, exploitable secret"
                )
                context_notes.append(
                    "⚠️ Environment variable template falls back to a seemingly genuine secret!"
                )
            else:
                mitigating_factors.append(
                    f"Template default '{default_val}' appears to be local/dev boilerplate"
                )
                context_notes.append("📝 Template fallback value is safe boilerplate")

    # === Check for high-exploitability secret types ===
    for stype in ThreatContext.HIGH_EXPLOITABILITY_TYPES:
        if stype in secret_type:
            risk_factors.append(f"High-value secret type: {stype}")
            context_notes.append(
                f"⚠️ {stype.upper()} credentials can be exploited immediately if valid"
            )
            break

    # === Check entropy (randomness) ===
    # Only count high entropy as a risk factor when we're NOT in a test file —
    # developers deliberately use high-entropy fixture values to exercise detectors.
    if entropy and entropy > 4.5 and not matched_test_pattern:
        risk_factors.append("High entropy suggests real secret")
        context_notes.append(
            f"🎲 High entropy ({entropy:.2f}) suggests this is a real secret, not a placeholder"
        )
    elif entropy and entropy < 3.0:
        mitigating_factors.append("Low entropy suggests placeholder or simple password")
        context_notes.append(
            f"🎲 Low entropy ({entropy:.2f}) suggests this may be a placeholder or weak password"
        )

    # === Determine exploitability ===
    # Test-file findings can never be EXPLOITABLE_NOW — they're fixtures by
    # construction. Cap at BAD_PRACTICE and downgrade to LIKELY_FALSE_POSITIVE
    # when additional mitigators pile on.
    if matched_test_pattern:
        if len(mitigating_factors) >= 3:
            exploitability = "LIKELY_FALSE_POSITIVE"
            confidence = 0.75
        else:
            exploitability = "BAD_PRACTICE"
            confidence = 0.7
    elif len(mitigating_factors) >= 2:
        exploitability = "LIKELY_FALSE_POSITIVE"
        confidence = 0.6
    elif len(mitigating_factors) >= 1 and len(risk_factors) == 0:
        exploitability = "BAD_PRACTICE"
        confidence = 0.7
    elif len(risk_factors) >= 1 and len(mitigating_factors) == 0:
        exploitability = "EXPLOITABLE_NOW"
        confidence = 0.85
    elif len(risk_factors) > len(mitigating_factors):
        exploitability = "EXPLOITABLE_NOW"
        confidence = 0.7
    else:
        exploitability = "BAD_PRACTICE"
        confidence = 0.6

    # === Determine risk level ===
    if exploitability == "LIKELY_FALSE_POSITIVE":
        risk_level = "INFO"
        recommended_action = "REVIEW"
    elif exploitability == "BAD_PRACTICE":
        risk_level = "MEDIUM"
        recommended_action = "FIX_WHEN_POSSIBLE"
    else:  # EXPLOITABLE_NOW
        risk_level = severity if severity in ["CRITICAL", "HIGH"] else "HIGH"
        recommended_action = "ROTATE_NOW"

    # Add summary context note
    if exploitability == "LIKELY_FALSE_POSITIVE":
        context_notes.insert(
            0, "✅ This appears to be a false positive or placeholder value"
        )
    elif exploitability == "BAD_PRACTICE":
        context_notes.insert(
            0, "⚡ This is a bad practice but likely not immediately exploitable"
        )
    else:
        context_notes.insert(
            0, "🚨 This secret may be exploitable immediately if valid"
        )

    return {
        "risk_level": risk_level,
        "exploitability": exploitability,
        "context_notes": context_notes,
        "confidence": confidence,
        "recommended_action": recommended_action,
        "risk_factors": risk_factors,
        "mitigating_factors": mitigating_factors,
    }


# ==============================================================================
# FRAMEWORK DETECTION
# ==============================================================================

# Framework detection patterns
FRAMEWORK_PATTERNS = {
    "spring_boot": [".java", "application.properties", "application.yml", "pom.xml"],
    "node_express": [".js", ".ts", "package.json", "express"],
    "django": [".py", "settings.py", "django", "manage.py"],
    "flask": [".py", "flask", "app.py"],
    "react": [".jsx", ".tsx", "react", "next.config"],
    "rails": [".rb", "Gemfile", "config/", "rails"],
    "dotnet": [".cs", ".csproj", "appsettings.json"],
    "go": [".go", "go.mod"],
}


def detect_framework(finding: Dict[str, Any]) -> str:
    """Detect the likely framework from the file path and language."""
    file_path = str(finding.get("file_path") or "").lower()
    language = str(finding.get("language") or "").lower()

    # Spring Boot
    if any(
        p in file_path for p in [".java", "application.properties", "application.yml"]
    ):
        return "Spring Boot"

    # Node.js / Express
    if (
        language in ["javascript", "typescript"]
        or ".js" in file_path
        or ".ts" in file_path
    ):
        if "next" in file_path or "react" in file_path:
            return "Next.js/React"
        return "Node.js"

    # Python frameworks
    if language == "python" or ".py" in file_path:
        if "settings" in file_path:
            return "Django"
        if "flask" in file_path or "app.py" in file_path:
            return "Flask"
        return "Python"

    # .NET
    if ".cs" in file_path or "appsettings" in file_path:
        return ".NET"

    # Go
    if ".go" in file_path:
        return "Go"

    # Ruby/Rails
    if ".rb" in file_path:
        return "Ruby/Rails"

    return "Generic"


def get_framework_specific_advice(framework: str, secret_type: str) -> str:
    """Get framework-specific remediation advice."""
    advice = {
        "Spring Boot": """
**Spring Boot Specific:**
- Use `application-{profile}.properties` for environment-specific configs
- Use `@Value("${ENV_VAR}")` annotation to inject environment variables
- Consider Spring Cloud Config or HashiCorp Vault for centralized secrets
- Add to `.gitignore`: `application-*.properties` (except templates)
""",
        "Node.js": """
**Node.js Specific:**
- Use `dotenv` package: `require('dotenv').config()`
- Access via `process.env.YOUR_SECRET`
- Never commit `.env` files - add to `.gitignore`
- For production, use platform env vars (Vercel, Heroku, AWS)
""",
        "Next.js/React": """
**Next.js/React Specific:**
- Use `.env.local` for local development (auto-loaded by Next.js)
- Prefix public vars with `NEXT_PUBLIC_` (exposed to browser)
- Server-only secrets should NOT have the prefix
- Access via `process.env.YOUR_SECRET`
""",
        "Django": """
**Django Specific:**
- Use `django-environ` or `python-decouple` package
- Store secrets in `.env` file (not committed)
- Use `env('SECRET_KEY')` in `settings.py`
- For production, use environment variables or secret managers
""",
        "Flask": """
**Flask Specific:**
- Use `python-dotenv` package
- Load with `from dotenv import load_dotenv; load_dotenv()`
- Access via `os.environ.get('YOUR_SECRET')`
- Use Flask config objects for different environments
""",
        ".NET": """
**.NET Specific:**
- Use User Secrets for development: `dotnet user-secrets set "Key" "Value"`
- Use `appsettings.Development.json` (not committed)
- Access via `IConfiguration["Key"]`
- For production, use Azure Key Vault or AWS Secrets Manager
""",
        "Go": """
**Go Specific:**
- Use `os.Getenv("YOUR_SECRET")` or `os.LookupEnv()`
- Use `godotenv` package for local development
- Consider Viper for configuration management
- Use environment variables in production
""",
        "Ruby/Rails": """
**Ruby/Rails Specific:**
- Use `dotenv-rails` gem for development
- Access via `ENV['YOUR_SECRET']`
- Use Rails credentials: `bin/rails credentials:edit`
- Store master key securely (not in repo)
""",
    }
    return advice.get(
        framework,
        """
**General Best Practice:**
- Store secrets in environment variables
- Use a `.env` file for local development (add to `.gitignore`)
- Use a secret manager in production (AWS Secrets Manager, HashiCorp Vault, etc.)
""",
    )


def get_gemini_fix(finding: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate comprehensive AI-powered security recommendations with context-aware threat modeling.

    Returns structured advice including:
    - Threat context analysis (exploitable now vs bad practice)
    - What the secret is and why it's risky
    - Calibrated immediate actions based on actual risk
    - Long-term fixes
    - Framework-specific guidance
    - Example .env and .gitignore entries
    """
    if not API_KEY:
        return {"error": "Google Gemini API key is not configured."}
    if not genai:
        return {"error": "google-genai SDK is not installed."}

    language = str(finding.get("language") or "Unknown")
    secret_type = str(finding.get("secret_type") or "Unknown Secret")
    code_snippet = str(finding.get("code_snippet") or finding.get("leaked_line") or "")
    line_number = finding.get("line_number", 0)
    file_path = str(finding.get("file_path") or "")
    try:
        entropy = float(finding.get("entropy", 0) or 0)
    except (TypeError, ValueError):
        entropy = 0.0

    # === CONTEXT-AWARE THREAT MODELING ===
    threat_context = analyze_threat_context(finding)
    exploitability = threat_context["exploitability"]
    risk_level = threat_context["risk_level"]
    context_notes = threat_context["context_notes"]
    recommended_action = threat_context["recommended_action"]

    # Detect framework
    framework = detect_framework(finding)
    framework_advice = get_framework_specific_advice(framework, secret_type)

    # Build context summary for the AI
    context_summary = "\n".join([f"- {note}" for note in context_notes])

    # Determine appropriate urgency language based on exploitability
    if exploitability == "EXPLOITABLE_NOW":
        urgency_guidance = """
URGENCY: HIGH - This appears to be a real, exploitable secret.
- Use urgent language: "Rotate immediately", "Critical", "High priority"
- Assume the secret is valid and could be actively exploited
- Provide specific rotation steps as the first action
"""
    elif exploitability == "BAD_PRACTICE":
        urgency_guidance = """
URGENCY: MEDIUM - This is a security anti-pattern but may not be immediately exploitable.
- Use measured language: "Should be fixed", "Best practice violation", "Improve when possible"
- Acknowledge this might be a dev/localhost credential
- Still provide rotation guidance but note it may not be urgent if truly local-only
- Focus on establishing good habits and preventing this pattern in production
"""
    else:  # LIKELY_FALSE_POSITIVE
        urgency_guidance = """
URGENCY: LOW - This appears to be a placeholder, example, or test value.
- Use calm language: "Review to confirm", "Likely safe", "Best practice reminder"
- Note that this appears to be a non-production value
- Suggest verifying it's not accidentally a real secret
- Provide general guidance on keeping example files clearly marked
"""

    prompt = f"""You are a senior security engineer providing a context-aware security assessment.

A **{secret_type}** was detected in a {language} file at `{file_path}` on line {line_number}.

## THREAT CONTEXT ANALYSIS
{context_summary}

**Exploitability Assessment:** {exploitability.replace('_', ' ').title()}
**Risk Level:** {risk_level}
**Recommended Action:** {recommended_action.replace('_', ' ').title()}
**Entropy:** {entropy:.2f} (higher = more random/likely real secret)
**Detected Framework:** {framework}

**Leaked Code:**
```{language.lower() if language != "Unknown" else ""}
{code_snippet}
```

{urgency_guidance}

---

Provide a professional, calibrated security report. CRITICAL: Match your tone and urgency to the actual risk level. Do not "cry wolf" on localhost database passwords or example API keys.

## 🎯 Risk Assessment
Start with a clear verdict in 1-2 sentences:
- If EXPLOITABLE_NOW: "This appears to be a production secret that requires immediate attention."
- If BAD_PRACTICE: "This is a security anti-pattern that should be fixed, but may not be immediately exploitable because [reason]."
- If LIKELY_FALSE_POSITIVE: "This appears to be a placeholder/example value. Verify it's not a real secret and consider marking the file more clearly as an example."

## 🔍 What Is This Secret?
Explain in 2-3 sentences what this type of secret is and what it's used for.

## ⚠️ Potential Risks
{f"Explain the specific risks if this secret is exposed (2-3 bullet points). Be concrete about what an attacker could do." if exploitability == "EXPLOITABLE_NOW" else "Explain why hardcoding secrets is problematic even in development, but acknowledge the limited immediate risk."}

## 📋 Recommended Actions

{f'''### 🚨 Immediate (Do Now)
1. **Revoke/Rotate**: Step-by-step instructions to invalidate the current secret
2. **Check for Abuse**: How to audit if the secret was already misused
3. **Generate New Secret**: Where/how to create a replacement''' if exploitability == "EXPLOITABLE_NOW" else f'''### ⚡ When You Have Time
1. **Verify**: Confirm this is truly a development-only credential
2. **Clean Up**: Remove from code and use environment variables
3. **Prevent**: Set up pre-commit hooks to catch this pattern''' if exploitability == "BAD_PRACTICE" else '''### 📝 Optional Review
1. **Verify**: Confirm this is a placeholder/example value
2. **Mark Clearly**: Ensure the file is clearly named as an example (e.g., `.example`, `.sample`)
3. **Document**: Add comments noting these are placeholder values'''}

## 🔧 Secure Code Pattern

### Before (Current):
```{language.lower() if language != "Unknown" else ""}
[Show the problematic code pattern]
```

### After (Recommended):
```{language.lower() if language != "Unknown" else ""}
[Show the fixed code using environment variables]
```

## 📁 Configuration Files

### .env.example (commit this):
```
{secret_type.upper().replace(' ', '_')}=your_secret_here
```

### .gitignore (add these lines):
```
.env
.env.local
.env.*.local
```

## 🏗️ Framework-Specific Guidance
{framework_advice}

Keep the response professional, concise, and appropriately calibrated to the actual risk. Use emojis sparingly for section headers only. Do not include conversational phrases.
"""

    try:
        client = genai.Client(api_key=API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=2000,
            ),
        )
        if not response.text:
            return {"error": "Empty response from Gemini."}

        # Include threat context in the response
        return {
            "suggestion": response.text,
            "threat_context": threat_context,
        }
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        error_text = str(e).lower()
        is_terminal = any(
            k in error_text
            for k in [
                "429",
                "quota",
                "rate limit",
                "503",
                "unavailable",
                "404",
                "not_found",
                "not found",
                "model",
                "unsupported",
                "permission denied",
                "401",
                "403",
                "api key",
            ]
        )
        return {
            "error": f"Failed to get Gemini suggestion: {e}",
            "_terminal_error": is_terminal,
        }


# ==============================================================================
# SMART AI ORCHESTRATOR
# ==============================================================================

# Per-scan budget (configurable via env)
MAX_AI_CALLS_PER_SCAN = int(os.getenv("MAX_AI_CALLS_PER_SCAN", "5"))
AI_CALL_TIMEOUT = int(os.getenv("AI_CALL_TIMEOUT", "30"))
# Separate budget for local Qwen (cheap/free → higher default)
MAX_QWEN_CALLS_PER_SCAN = int(os.getenv("MAX_QWEN_CALLS_PER_SCAN", "10"))
QWEN_CALL_TIMEOUT = int(os.getenv("QWEN_CALL_TIMEOUT", str(_QWEN_TIMEOUT + 10)))

_TERMINAL_ERROR_KEYWORDS = (
    "429", "quota", "rate limit", "503", "unavailable",
    "404", "not_found", "not found", "model", "unsupported",
    "permission denied", "401", "403", "api key",
)


def _is_terminal_error(result: Dict[str, Any]) -> bool:
    """Detect Gemini errors that warrant circuit-breaking the provider for the scan."""
    if result.get("_terminal_error"):
        return True
    err = str(result.get("error", "")).lower()
    return any(k in err for k in _TERMINAL_ERROR_KEYWORDS)


def _finding_dedup_key(f: Dict[str, Any]) -> str:
    """Produce a stable key so identical secret+context findings share one AI call."""
    secret_value = (
        f.get("raw_value") or f.get("detected_value") or f.get("masked_value") or ""
    )
    normalized_secret = re.sub(r"\s+", "", str(secret_value).lower())
    if not normalized_secret:
        fallback_text = f.get("code_snippet", f.get("leaked_line", ""))
        normalized_secret = re.sub(r"\s+", " ", str(fallback_text).strip().lower())

    ctx = f.get("threat_context", {})
    parts = [
        str(f.get("secret_type") or ""),
        str(ctx.get("exploitability") or ""),
        normalized_secret,
    ]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def _is_medium_ambiguous(finding: Dict[str, Any]) -> bool:
    """
    MEDIUM findings should only call AI when deterministic logic is uncertain.
    """
    ctx = finding.get("threat_context", {})
    if not ctx:
        return True

    confidence = float(ctx.get("confidence", 0.0))
    risk_factors = ctx.get("risk_factors", []) or []
    mitigating_factors = ctx.get("mitigating_factors", []) or []
    exploitability = ctx.get("exploitability", "")

    if exploitability == "LIKELY_FALSE_POSITIVE":
        return False

    # Ambiguous if we have mixed signals or low confidence.
    return (len(risk_factors) > 0 and len(mitigating_factors) > 0) or confidence < 0.65


def should_call_ai(finding: Dict[str, Any]) -> bool:
    """Decide whether a finding warrants an AI call based on recalibrated severity and threat context."""
    if finding.get("ai_remediation_eligible") is False:
        return False

    sev = finding.get("severity", "HIGH")

    # Always call for CRITICAL/HIGH
    if sev in ("CRITICAL", "HIGH"):
        return True

    # MEDIUM only if deterministic analysis is ambiguous
    if sev == "MEDIUM":
        return _is_medium_ambiguous(finding)

    # LOW or false-positive: skip AI
    return False


def _deterministic_fallback(finding: Dict[str, Any]) -> Dict[str, Any]:
    """Provide a lightweight, deterministic remediation when AI is skipped or unavailable."""
    ctx = finding.get("threat_context", {})
    exp = ctx.get("exploitability", "BAD_PRACTICE")
    action = ctx.get("recommended_action", "REVIEW")
    notes = ctx.get("context_notes", [])

    if exp == "LIKELY_FALSE_POSITIVE":
        summary = "This finding appears to be a placeholder or example value. Verify it is not a real secret."
    elif exp == "BAD_PRACTICE":
        summary = "This is a security anti-pattern. Move the value to environment variables even in development."
    else:
        summary = (
            "This secret should be rotated immediately, then moved to a secret manager."
        )

    framework = detect_framework(finding)
    advice = get_framework_specific_advice(framework, finding.get("secret_type", ""))

    return {
        "suggestion": f"## 🎯 Risk Assessment\n{summary}\n\n"
        f"## 📋 Recommended Action\n**{action.replace('_', ' ').title()}**\n\n"
        f"## 🏗️ Framework Guidance\n{advice.strip()}\n",
        "threat_context": ctx,
        "ai_generated": False,
    }


async def run_ai_remediation(
    findings: List[Dict[str, Any]],
    on_finding_processed: Optional[Callable[[int, Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """
    Orchestrate AI calls across a list of findings with:
    - Severity gating (skip LOW / false positives)
    - Deduplication (same secret+context → one call)
    - Gemini primary with per-scan budget + circuit-breaker on quota/model errors
    - Qwen (local Ollama) fallback when Gemini fails or is exhausted
    - Deterministic fallback when both AI providers fail
    """
    import asyncio

    gemini_budget = MAX_AI_CALLS_PER_SCAN
    qwen_budget = MAX_QWEN_CALLS_PER_SCAN
    gemini_broken = not (API_KEY and genai)
    qwen_broken = not (get_qwen_fix and is_qwen_available())
    dedup_cache: Dict[str, Dict[str, Any]] = {}
    ai_calls_made = 0       # Gemini successes
    ai_calls_qwen = 0       # Qwen fallback successes
    ai_calls_skipped = 0
    ai_calls_deduped = 0

    if qwen_broken:
        print("ℹ️ Qwen fallback unavailable (Ollama not running or model not pulled).")
    else:
        print("✅ Qwen fallback ready (local Ollama).")

    def notify_processed(index: int, finding: Dict[str, Any]) -> None:
        if not on_finding_processed:
            return
        try:
            on_finding_processed(index, finding)
        except Exception as cb_exc:
            print(f"⚠️ AI progress callback failed at index {index}: {cb_exc}")

    async def _try_qwen(f: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Call Qwen, returning a success dict or None on error."""
        nonlocal qwen_broken, qwen_budget
        if qwen_broken or qwen_budget <= 0:
            return None
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(get_qwen_fix, f),
                timeout=QWEN_CALL_TIMEOUT,
            )
        except asyncio.TimeoutError:
            print(f"⚡ Qwen call timed out after {QWEN_CALL_TIMEOUT}s.")
            return None
        except Exception as exc:
            print(f"⚡ Qwen call failed: {exc}")
            return None

        qwen_budget -= 1
        if result.get("_terminal_error"):
            print(f"⚡ Qwen terminal error — disabling Qwen for this scan: {result.get('error')}")
            qwen_broken = True
            return None
        if "suggestion" not in result:
            print(f"⚡ Qwen returned error: {result.get('error')}")
            return None
        return result

    for index, f in enumerate(findings):
        needs_ai = should_call_ai(f)
        key = f"{_finding_dedup_key(f)}|needs_ai:{int(needs_ai)}"

        # 1. Dedup cache
        if key in dedup_cache:
            cached = copy.deepcopy(dedup_cache[key])
            cached["ai_status"] = "deduped"
            f["ai_fix"] = cached
            ai_calls_deduped += 1
            notify_processed(index, f)
            continue

        # 2. Severity gate
        if not needs_ai:
            fallback = _deterministic_fallback(f)
            fallback["ai_status"] = "skipped_low_risk"
            f["ai_fix"] = fallback
            dedup_cache[key] = fallback
            ai_calls_skipped += 1
            notify_processed(index, f)
            continue

        result: Optional[Dict[str, Any]] = None

        # 3. Try Gemini (primary)
        gemini_available = not gemini_broken and gemini_budget > 0
        if gemini_available:
            try:
                gemini_result = await asyncio.wait_for(
                    asyncio.to_thread(get_gemini_fix, f),
                    timeout=AI_CALL_TIMEOUT,
                )
            except asyncio.TimeoutError:
                gemini_result = {"error": f"Gemini call timed out after {AI_CALL_TIMEOUT}s"}
            except Exception as exc:
                gemini_result = {"error": f"Gemini call failed: {exc}"}

            gemini_budget -= 1

            if _is_terminal_error(gemini_result):
                print(
                    "⚡ Gemini terminal error — circuit-breaking Gemini, switching to Qwen fallback."
                )
                gemini_broken = True
            elif "suggestion" in gemini_result:
                gemini_result.pop("_terminal_error", None)
                gemini_result["ai_status"] = "success"
                gemini_result["ai_generated"] = True
                gemini_result["ai_provider"] = "gemini"
                gemini_result["ai_model"] = GEMINI_MODEL
                result = gemini_result
                ai_calls_made += 1
            else:
                print(f"⚡ Gemini returned non-terminal error — trying Qwen: {gemini_result.get('error')}")

        # 4. Qwen fallback
        if result is None:
            qwen_result = await _try_qwen(f)
            if qwen_result is not None:
                qwen_result["ai_status"] = "success_fallback"
                qwen_result["ai_generated"] = True
                result = qwen_result
                ai_calls_qwen += 1

        # 5. Deterministic fallback
        if result is None:
            fallback = _deterministic_fallback(f)
            if gemini_broken and qwen_broken:
                fallback["ai_status"] = "all_providers_failed"
            elif gemini_broken:
                fallback["ai_status"] = "circuit_broken"
            elif gemini_budget <= 0 and qwen_budget <= 0:
                fallback["ai_status"] = "budget_exhausted"
            else:
                fallback["ai_status"] = "error"
            f["ai_fix"] = fallback
            dedup_cache[key] = fallback
            ai_calls_skipped += 1
            notify_processed(index, f)
            continue

        f["ai_fix"] = result
        dedup_cache[key] = result
        notify_processed(index, f)

    return {
        "ai_calls_made": ai_calls_made,
        "ai_calls_qwen": ai_calls_qwen,
        "ai_calls_skipped": ai_calls_skipped,
        "ai_calls_deduped": ai_calls_deduped,
        "budget_limit": MAX_AI_CALLS_PER_SCAN,
        "qwen_budget_limit": MAX_QWEN_CALLS_PER_SCAN,
        "circuit_broken": gemini_broken,
        "qwen_available": not qwen_broken,
    }
