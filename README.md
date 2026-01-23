# 🛡️ Secret Guardian

> **AI-Powered Secret Detection & Remediation Tool**

Secret Guardian is a standalone security tool that scans public GitHub repositories for leaked secrets (API keys, credentials, tokens) and provides AI-powered remediation suggestions.

![Secret Guardian Banner](https://img.shields.io/badge/Security-Tool-blue?style=for-the-badge&logo=shield)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-purple?style=for-the-badge)

---

## 📋 Table of Contents

- [What It Does](#-what-it-does)
- [What It Does NOT Do](#-what-it-does-not-do)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [How It Works](#-how-it-works)
- [Quick Start](#-quick-start)
- [API Documentation](#-api-documentation)
- [Example Scan Output](#-example-scan-output)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Security & Privacy](#-security--privacy)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✅ What It Does

Secret Guardian provides comprehensive secret detection capabilities:

| Feature | Description |
|---------|-------------|
| 🔍 **Multi-Scanner Detection** | Combines regex patterns, Gitleaks, and TruffleHog for maximum coverage |
| 🎯 **35+ Secret Types** | Detects AWS keys, API tokens, private keys, database credentials, and more |
| 📊 **Entropy Analysis** | Uses Shannon entropy to identify random/generated secrets |
| 🤖 **AI Remediation** | Provides framework-aware fix suggestions using Google Gemini |
| 📈 **Severity Scoring** | Categorizes findings as CRITICAL, HIGH, MEDIUM, or LOW |
| 📁 **Grouped Results** | Organizes findings by file for easy navigation |
| 🔒 **Masked Secrets** | All detected secrets are masked by default for safety |
| 📤 **Export Options** | Export results as JSON or copy summary to clipboard |
| 📦 **ZIP Upload** | Upload ZIP files for local scanning without GitHub |

---

## ❌ What It Does NOT Do

| Limitation | Reason |
|------------|--------|
| ❌ **No Private Repos** | V1 only supports public GitHub repositories (use ZIP upload for private code) |
| ❌ **No GitHub Auth** | Does not require or use GitHub authentication |
| ❌ **No Data Storage** | All repository content is deleted after scanning |
| ❌ **No Code Modification** | Read-only scanning - never modifies your code |
| ❌ **No Git History Scan** | Scans current files only, not commit history |

---

## ✨ Features

### 🔍 Scanning Engine

- **Regex-based Detection**: 35+ patterns for known secret formats
- **Gitleaks Integration**: Industry-standard scanner with 100+ rules (optional)
- **TruffleHog Integration**: Deep entropy-based detection (optional)
- **Deduplication**: Removes duplicate findings across scanners
- **Timeout Protection**: Enforces scan timeout to prevent hanging
- **ZIP Upload Support**: Scan local code by uploading a ZIP file (max 50MB)

### 🎨 User Interface

- **Single URL Input**: Just paste a GitHub URL and scan
- **Real-time Progress**: Loading states and progress indicators
- **Severity Indicators**: Color-coded badges (🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low)
- **Collapsible Sections**: Findings grouped by file with expand/collapse
- **Code Viewer**: Syntax-highlighted code with line numbers
- **Secret Masking**: Toggle to reveal/hide secrets with warning dialog

### 🤖 AI Remediation

Each finding includes:
- **What Is This Secret?** - Plain-language explanation
- **Why Is This Dangerous?** - Specific risks and attack scenarios
- **Immediate Actions** - Steps to revoke/rotate the secret
- **Secure Code Fix** - Before/after code examples
- **Framework-Specific Guidance** - Spring Boot, Node.js, Django, etc.
- **.env Example** - Template for environment variables
- **.gitignore Entry** - What to add to prevent future leaks

### 🎯 Context-Aware Threat Modeling

Not all secrets are equally dangerous. Secret Guardian analyzes context to provide calibrated risk assessments:

| Assessment | Description | Example |
|------------|-------------|---------|
| 🚨 **Exploitable Now** | Real production secret that could be abused immediately | AWS keys in production config |
| ⚡ **Bad Practice** | Security anti-pattern with limited immediate risk | Localhost database password |
| ✅ **Likely Safe** | Placeholder, example, or test value | `your-api-key-here` in example file |

**Context indicators detected:**
- Localhost/dev references (`localhost`, `127.0.0.1`, `test`, `staging`)
- Test file patterns (`_test.py`, `.spec.js`, `fixtures/`, `examples/`)
- Placeholder values (`your-api-key`, `xxx`, `placeholder`, `${VAR}`)
- Test mode keys (`sk_test_*` for Stripe, etc.)

### 📤 Export & Sharing

- **JSON Export**: Download complete findings as structured JSON
- **Summary Copy**: Copy formatted summary to clipboard
- **PDF Export**: Coming soon

---

## 📸 Screenshots

### Scan Page
```
┌─────────────────────────────────────────────────────────────┐
│  🛡️ Secret Guardian                                         │
│  AI-Powered Secret Detection & Remediation                  │
├─────────────────────────────────────────────────────────────┤
│  [GitHub URL Input........................] [Scan Repository]│
│                                                             │
│  📊 Scan Summary                                            │
│  ┌─────────┐ ┌─────────┐ ┌──────────────┐ ┌─────────┐      │
│  │ 5       │ │ 3       │ │ 🔴1 🟠2 🟡2  │ │ 2.4s    │      │
│  │ Secrets │ │ Files   │ │ Severity     │ │ Duration│      │
│  └─────────┘ └─────────┘ └──────────────┘ └─────────┘      │
│                                                             │
│  📁 src/config/database.js                          [HIGH]  │
│  ├── Line 15: MongoDB Connection String                     │
│  └── Line 23: AWS Access Key ID                             │
│                                                             │
│  📁 .env.example                                   [MEDIUM] │
│  └── Line 8: Generic API Key                                │
└─────────────────────────────────────────────────────────────┘
```

### Finding Detail
```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 CRITICAL │ Line 15 │ AWS Access Key ID │ HIGH Confidence │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ const awsKey = "AKIA****************ABCD";              │ │
│ │ // ^^^^^^^^^ detected secret                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 🔒 Detected Value: AKIA****ABCD  [👁️ Reveal] [📋 Copy]     │
├─────────────────────────────────────────────────────────────┤
│ ⚡ AI Security Recommendation                               │
│ ─────────────────────────────────────────────────────────── │
│ ## 🔍 What Is This Secret?                                  │
│ An AWS Access Key ID that provides programmatic access...   │
│                                                             │
│ ## ⚠️ Why Is This Dangerous?                                │
│ • Attackers can access your AWS resources                   │
│ • Potential for unauthorized charges                        │
│ • Data exfiltration risk                                    │
│                                                             │
│ ## 🔧 Secure Code Fix                                       │
│ ```javascript                                               │
│ const awsKey = process.env.AWS_ACCESS_KEY_ID;              │
│ ```                                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 How It Works

### Scan Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. Clone   │────▶│  2. Scan    │────▶│ 3. Analyze  │
│  Repository │     │  Files      │     │  Results    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
  Temp directory     Multi-scanner       Deduplicate &
  with timeout       execution           assign severity
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 4. AI Fix   │────▶│ 5. Return   │────▶│ 6. Cleanup  │
│ Suggestions │     │  Results    │     │  Temp Files │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Detection Methods

| Method | Description | Coverage |
|--------|-------------|----------|
| **Regex Patterns** | 35+ patterns for known secret formats | API keys, tokens, credentials |
| **Entropy Analysis** | Shannon entropy > 4.5 = likely secret | Unknown/custom secrets |
| **Gitleaks** | Industry-standard scanner (if installed) | 100+ additional rules |
| **TruffleHog** | Deep entropy detection (if installed) | High-entropy strings |

### Severity Assignment

| Level | Criteria | Examples |
|-------|----------|----------|
| 🔴 **CRITICAL** | Private keys, AWS secrets | RSA keys, AWS Secret Access Key |
| 🟠 **HIGH** | Service tokens, DB credentials | GitHub tokens, MongoDB strings |
| 🟡 **MEDIUM** | API keys with limited scope | Google API keys, Stripe test keys |
| 🟢 **LOW** | Low confidence or generic patterns | Generic API key patterns |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/secret-guardian.git
cd secret-guardian

# Start everything with one command
./start.sh
```

Or manually:

```bash
# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add your GOOGLE_API_KEY
uvicorn main:app --reload --port 8000

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

### Optional: Install External Scanners

For enhanced detection, install Gitleaks and/or TruffleHog:

```bash
# Gitleaks (macOS)
brew install gitleaks

# TruffleHog
pip install trufflehog

# Verify installation
gitleaks version
trufflehog --version
```

### Environment Variables

Create `backend/.env`:

```env
# Required for AI remediation
GOOGLE_API_KEY=your_gemini_api_key_here
```

---

## 📡 API Documentation

### Scan Repository (GitHub URL)

```http
POST /scan
Content-Type: application/json

{
  "repo_url": "https://github.com/username/repository"
}
```

**Response:**
```json
{
  "findings": [...],
  "total_findings": 5,
  "files_affected": 3,
  "severity_breakdown": {
    "CRITICAL": 1,
    "HIGH": 2,
    "MEDIUM": 1,
    "LOW": 1
  },
  "scan_duration": 2.45,
  "scanners_used": ["regex", "gitleaks"],
  "has_critical": true,
  "has_high": true
}
```

### Scan Uploaded ZIP File

```http
POST /scan/upload
Content-Type: multipart/form-data

file: <your-code.zip>
```

**Limits:**
- Maximum file size: 50MB
- Only ZIP files accepted
- Files extracted temporarily and deleted after scan

**Response:**
```json
{
  "findings": [...],
  "total_findings": 3,
  "files_affected": 2,
  "severity_breakdown": {...},
  "scan_duration": 1.23,
  "source": "upload",
  "filename": "my-project.zip",
  "file_size_mb": 2.45
}
```

### Export JSON

```http
POST /export/json
Content-Type: application/json

{
  "findings": [...],
  "repo_url": "https://github.com/...",
  "scan_duration": 2.45,
  "severity_breakdown": {...}
}
```

### Health Check

```http
GET /health
```

### API Info

```http
GET /info
```

Full API documentation available at: `http://localhost:8000/docs`

---

## 📊 Example Scan Output

```json
{
  "findings": [
    {
      "secret_type": "AWS Access Key ID",
      "file_path": "src/config/aws.js",
      "line_number": 15,
      "confidence": "HIGH",
      "entropy": 4.2,
      "raw_value": "AKIA****WXYZ",
      "severity": "CRITICAL",
      "scanner_source": "regex",
      "language": "JavaScript",
      "code_snippet": "const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';",
      "ai_fix": {
        "suggestion": "## 🔍 What Is This Secret?\n..."
      }
    }
  ],
  "total_findings": 1,
  "files_affected": 1,
  "severity_breakdown": {
    "CRITICAL": 1,
    "HIGH": 0,
    "MEDIUM": 0,
    "LOW": 0
  },
  "scan_duration": 1.23,
  "scanners_used": ["regex"],
  "has_critical": true,
  "has_high": false
}
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS |
| **Backend** | FastAPI, Python 3.12, Pydantic |
| **AI** | Google Gemini API |
| **Scanners** | Regex, Gitleaks (optional), TruffleHog (optional) |
| **Git** | GitPython for repository cloning |

---

## 📁 Project Structure

```
secret-guardian/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── scanner.py           # Core scanning logic
│   ├── external_scanners.py # Gitleaks/TruffleHog integration
│   ├── patterns.py          # Regex patterns & entropy
│   ├── ai_fixer.py          # Gemini AI integration
│   ├── cache.py             # Result caching
│   ├── rate_limiter.py      # Rate limiting
│   ├── validators.py        # Input validation
│   ├── performance.py       # Performance monitoring
│   └── requirements.txt     # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx     # Landing page
│   │   │   └── scan/
│   │   │       └── page.tsx # Scan page
│   │   └── components/
│   │       └── ui/          # UI components
│   ├── package.json         # Node dependencies
│   └── tailwind.config.js   # Tailwind configuration
│
├── start.sh                 # One-command startup
└── README.md                # This file
```

---

## 🔐 Security & Privacy

### Trust Controls

| Control | Implementation |
|---------|---------------|
| 🔒 **Secrets Masked** | All detected values masked by default (show first/last 4 chars) |
| 🗑️ **No Storage** | Repository cloned to temp directory, deleted after scan |
| ⏱️ **Timeout** | 5-minute maximum scan time to prevent abuse |
| 🚦 **Rate Limiting** | 10 scans/minute, 100 scans/hour per IP |
| 🔐 **Read-Only** | Never modifies repository content |

### Disclaimer

> ⚠️ **Important**: This tool is for educational and security auditing purposes only. Always:
> - Rotate any secrets detected immediately
> - Never paste private keys or sensitive data manually
> - Use on repositories you own or have permission to scan
> - Follow responsible disclosure practices

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Gitleaks](https://github.com/gitleaks/gitleaks) - Fast secret scanner
- [TruffleHog](https://github.com/trufflesecurity/trufflehog) - Entropy-based detection
- [Google Gemini](https://ai.google.dev/) - AI-powered remediation
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Next.js](https://nextjs.org/) - React framework

---

<div align="center">
  <p>Made with ❤️ for secure code</p>
  <p>🛡️ <strong>Secret Guardian</strong> - Protect Your Code, Stop API Key Leaks</p>
</div>



## Example :-https://github.com/aman247av/Mess-Management-System-IIITG
