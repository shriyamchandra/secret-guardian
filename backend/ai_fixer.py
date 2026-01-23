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
from typing import Dict, Any, Tuple

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


API_KEY = os.getenv("GOOGLE_API_KEY")


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
        r"\$\{.*\}",
        r"\{\{.*\}\}",
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
    file_path = finding.get("file_path", "").lower()
    code_snippet = finding.get("code_snippet", finding.get("leaked_line", "")).lower()
    secret_type = finding.get("secret_type", "").lower()
    severity = finding.get("severity", "HIGH")
    entropy = finding.get("entropy", 0)

    context_notes = []
    risk_factors = []
    mitigating_factors = []

    # === Check for development/localhost indicators ===
    for pattern in ThreatContext.DEV_INDICATORS:
        if re.search(pattern, code_snippet, re.IGNORECASE):
            mitigating_factors.append(f"Contains development indicator: '{pattern}'")
            context_notes.append(
                f"🔍 Detected development/localhost indicator: '{pattern}'"
            )

    # === Check for test file patterns ===
    for pattern in ThreatContext.TEST_FILE_PATTERNS:
        if re.search(pattern, file_path, re.IGNORECASE):
            mitigating_factors.append(f"File appears to be test/example: '{pattern}'")
            context_notes.append(f"📁 File path suggests test/example file")
            break

    # === Check for placeholder values ===
    for pattern in ThreatContext.PLACEHOLDER_PATTERNS:
        if re.search(pattern, code_snippet, re.IGNORECASE):
            mitigating_factors.append(f"Value appears to be placeholder: '{pattern}'")
            context_notes.append(
                f"📝 Value appears to be a placeholder, not a real secret"
            )
            break

    # === Check for high-exploitability secret types ===
    for stype in ThreatContext.HIGH_EXPLOITABILITY_TYPES:
        if stype in secret_type:
            risk_factors.append(f"High-value secret type: {stype}")
            context_notes.append(
                f"⚠️ {stype.upper()} credentials can be exploited immediately if valid"
            )
            break

    # === Check entropy (randomness) ===
    if entropy and entropy > 4.5:
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
    if len(mitigating_factors) >= 2:
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
    file_path = finding.get("file_path", "").lower()
    language = finding.get("language", "").lower()

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

    language = finding.get("language", "Unknown")
    secret_type = finding.get("secret_type", "Unknown Secret")
    code_snippet = finding.get("code_snippet", finding.get("leaked_line", ""))
    line_number = finding.get("line_number", 0)
    file_path = finding.get("file_path", "")
    severity = finding.get("severity", "HIGH")
    entropy = finding.get("entropy", 0)

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
            model="gemini-2.0-flash-exp",
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
        return {"error": f"Failed to get Gemini suggestion: {e}"}
