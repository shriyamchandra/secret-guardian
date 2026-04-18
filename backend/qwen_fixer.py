"""
Local AI Remediation Engine — Qwen2.5-Coder via Ollama

Runs entirely on-device with zero cloud dependency. Used as a fallback when
Gemini is unavailable (quota exhausted, network error, missing API key, etc.).

Architecture:
    Ollama service  <--HTTP-->  qwen_fixer.py  <--called by-->  ai_fixer.py
    (localhost:11434)           (this module)                    (orchestrator)

Exposes ``get_qwen_fix()`` mirroring ``get_gemini_fix()`` so the orchestrator
can swap providers transparently.
"""

import os
from typing import Dict, Any

import httpx
from dotenv import load_dotenv

_here = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_here, ".env")
load_dotenv(dotenv_path=_env_path, override=False)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen2.5-coder:7b-instruct")
QWEN_TIMEOUT = int(os.getenv("QWEN_TIMEOUT", "120"))
QWEN_TEMPERATURE = float(os.getenv("QWEN_TEMPERATURE", "0.3"))
QWEN_NUM_CTX = int(os.getenv("QWEN_NUM_CTX", "4096"))
QWEN_NUM_PREDICT = int(os.getenv("QWEN_NUM_PREDICT", "2048"))


def is_qwen_available() -> bool:
    """Return True when Ollama is running and the configured model is pulled."""
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code != 200:
            return False
        names = [m.get("name", "") for m in resp.json().get("models", [])]
        return any(QWEN_MODEL in name or name in QWEN_MODEL for name in names)
    except Exception:
        return False


def get_qwen_model_info() -> Dict[str, Any]:
    """Metadata about the loaded Qwen model (for frontend/admin endpoints)."""
    return {
        "model": QWEN_MODEL,
        "provider": "ollama_local",
        "available": is_qwen_available(),
        "base_url": OLLAMA_BASE_URL,
        "context_window": QWEN_NUM_CTX,
    }


def _detect_framework(file_path: str) -> str:
    fp = file_path.lower()
    if ".java" in fp or "application.properties" in fp or "application.yml" in fp:
        return "Spring Boot / Java"
    if ".py" in fp:
        if "settings" in fp:
            return "Django"
        if "flask" in fp or "app.py" in fp:
            return "Flask"
        return "Python"
    if ".ts" in fp or ".tsx" in fp or ".js" in fp or ".jsx" in fp:
        return "Next.js" if "next" in fp else "Node.js"
    if ".go" in fp:
        return "Go"
    if ".rb" in fp:
        return "Ruby/Rails"
    if ".cs" in fp:
        return ".NET"
    return "Generic"


def _build_remediation_prompt(finding: Dict[str, Any]) -> str:
    language = str(finding.get("language") or "Unknown")
    secret_type = str(finding.get("secret_type") or "Unknown Secret")
    code_snippet = str(
        finding.get("code_snippet") or finding.get("leaked_line") or ""
    )
    line_number = finding.get("line_number", 0)
    file_path = str(finding.get("file_path") or "")
    try:
        entropy = float(finding.get("entropy", 0) or 0)
    except (TypeError, ValueError):
        entropy = 0.0

    threat_ctx = finding.get("threat_context", {})
    exploitability = threat_ctx.get("exploitability", "UNKNOWN")
    risk_level = threat_ctx.get("risk_level", "HIGH")
    recommended_action = threat_ctx.get("recommended_action", "REVIEW")
    context_notes = threat_ctx.get("context_notes", [])

    context_summary = (
        "\n".join(f"- {n}" for n in context_notes)
        if context_notes
        else "- No additional context."
    )

    framework = _detect_framework(file_path)

    if exploitability == "EXPLOITABLE_NOW":
        urgency = (
            "URGENCY: HIGH. This is a real, exploitable secret.\n"
            "Use urgent language. Provide rotation steps as the first action."
        )
    elif exploitability == "BAD_PRACTICE":
        urgency = (
            "URGENCY: MEDIUM. Security anti-pattern but likely not immediately exploitable.\n"
            "Use measured language. Focus on establishing good habits."
        )
    else:
        urgency = (
            "URGENCY: LOW. Likely a placeholder, example, or test value.\n"
            "Use calm language. Suggest verifying it is not a real secret."
        )

    return f"""You are a senior security engineer. A secret was detected in source code.
Provide a professional, concise security remediation report.

## Finding Details
- **Secret type:** {secret_type}
- **File:** `{file_path}` (line {line_number})
- **Language/Framework:** {language} / {framework}
- **Entropy:** {entropy:.2f}
- **Exploitability:** {exploitability.replace('_', ' ').title()}
- **Risk Level:** {risk_level}
- **Recommended Action:** {recommended_action.replace('_', ' ').title()}

## Context
{context_summary}

## Leaked Code
```{language.lower() if language != "Unknown" else ""}
{code_snippet}
```

{urgency}

---

Write a security report with these sections (use the exact headers):

## 🎯 Risk Assessment
1-2 sentence verdict on the finding.

## 🔍 What Is This Secret?
2-3 sentences explaining what this secret type is.

## ⚠️ Potential Risks
2-3 bullet points on what an attacker could do.

## 📋 Recommended Actions
Step-by-step remediation:
1. Immediate action (rotate/revoke if needed)
2. Move secret to environment variables
3. Add pre-commit hooks to prevent future leaks

## 🔧 Secure Code Pattern
Show before (current) and after (fixed) code using environment variables for {framework}.

## 📁 Configuration Files
Show .env.example and .gitignore entries.

Keep it concise, professional, and calibrated to the actual risk level. Use emojis only in section headers."""


def get_qwen_fix(finding: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate AI-powered remediation using Qwen2.5-Coder via Ollama.

    Returns the same schema as ``get_gemini_fix()``:
        {
            "suggestion": str,
            "threat_context": dict,
            "ai_model": str,
            "ai_provider": "ollama_local",
        }
    """
    if not is_qwen_available():
        return {
            "error": (
                "Qwen model not available. Ensure Ollama is running "
                f"(`ollama serve`) and the model is pulled (`ollama pull {QWEN_MODEL}`)."
            ),
            "_terminal_error": True,
        }

    prompt = _build_remediation_prompt(finding)
    threat_context = finding.get("threat_context", {})

    try:
        resp = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": QWEN_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": QWEN_TEMPERATURE,
                    "num_ctx": QWEN_NUM_CTX,
                    "num_predict": QWEN_NUM_PREDICT,
                },
            },
            timeout=QWEN_TIMEOUT,
        )

        if resp.status_code != 200:
            return {
                "error": f"Ollama returned HTTP {resp.status_code}: {resp.text[:300]}",
                "_terminal_error": resp.status_code in (404, 400),
            }

        response_text = (resp.json().get("response") or "").strip()
        if not response_text:
            return {"error": "Empty response from Qwen model."}

        return {
            "suggestion": response_text,
            "threat_context": threat_context,
            "ai_model": QWEN_MODEL,
            "ai_provider": "ollama_local",
        }

    except httpx.TimeoutException:
        return {
            "error": (
                f"Qwen model timed out after {QWEN_TIMEOUT}s. "
                "Try increasing QWEN_TIMEOUT or reducing QWEN_NUM_CTX."
            ),
        }
    except httpx.ConnectError:
        return {
            "error": "Cannot connect to Ollama. Start it with: `ollama serve`",
            "_terminal_error": True,
        }
    except Exception as e:
        return {"error": f"Qwen inference failed: {e}"}
