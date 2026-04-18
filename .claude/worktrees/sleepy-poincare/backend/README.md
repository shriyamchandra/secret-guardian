# Secret Guardian Backend

FastAPI-based backend for scanning GitHub repositories for leaked secrets and providing AI-powered fix suggestions using Google Gemini.

## 🚀 Quick Start

### Prerequisites
- Python 3.12+ (installed via Homebrew)
- Google Gemini API Key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation & Running

#### Option 1: Using the Run Script (Easiest)
```bash
cd backend
./run.sh
```

#### Option 2: Manual Setup
```bash
# Navigate to backend directory
cd backend

# Activate virtual environment
source venv/bin/activate

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Option 3: Using VS Code Tasks
1. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Tasks: Run Task"
3. Select "Start Backend Server"

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Google Gemini API Key (Required)
GOOGLE_API_KEY=your_api_key_here
```

### Dependencies

All dependencies are listed in `requirements.txt`:

- **fastapi** - Modern web framework for building APIs
- **uvicorn** - ASGI server for running FastAPI
- **pydantic** - Data validation using Python type hints
- **gitpython** - Git repository manipulation
- **python-dotenv** - Environment variable management
- **google-genai** - Google Gemini AI SDK

## 📡 API Endpoints

### Health Check
```http
GET /
```
Returns basic API information.

### Scan Repository
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
  "status": "success",
  "findings": [
    {
      "file_path": "config.py",
      "line_number": 23,
      "secret_type": "Google API Key",
      "code_snippet": "API_KEY = 'AIza...'",
      "language": "Python",
      "ai_suggestion": {
        "suggestion": "Detailed fix instructions..."
      }
    }
  ]
}
```

## 🏗️ Project Structure

```
backend/
├── main.py              # FastAPI application entry point
├── scanner.py           # Repository scanning logic
├── ai_fixer.py          # Google Gemini AI integration
├── patterns.py          # Secret detection patterns
├── requirements.txt     # Python dependencies
├── run.sh              # Convenience run script
├── .env                # Environment variables (create this)
├── .env.example        # Example environment file
└── venv/               # Virtual environment (auto-generated)
```

## 🔍 How It Works

1. **Repository Cloning**: Clones the target GitHub repository to a temporary directory
2. **File Scanning**: Recursively scans all files for secret patterns
3. **Pattern Matching**: Uses regex patterns to detect various types of secrets:
   - API Keys (Google, AWS, OpenAI, etc.)
   - Database credentials
   - JWT tokens
   - Private keys
   - And more...
4. **AI Analysis**: Sends findings to Google Gemini for intelligent fix suggestions
5. **Cleanup**: Removes temporary files after scanning

## 🛠️ Development

### Python Version
This project uses **Python 3.12.12** via a virtual environment.

### Running in Development Mode
The server runs with `--reload` flag by default, which automatically restarts when code changes are detected.

### Accessing API Documentation
Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📊 Server Status

When running, the server will be available at:
- **Local**: http://localhost:8000
- **Network**: http://0.0.0.0:8000

## ⚠️ Common Issues

### Issue: "API key not valid"
**Solution**: Ensure your `GOOGLE_API_KEY` in `.env` is valid and active.

### Issue: "Module not found"
**Solution**: Activate the virtual environment and reinstall dependencies:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: "Permission denied" when running run.sh
**Solution**: Make the script executable:
```bash
chmod +x run.sh
```

## 🔒 Security Notes

- Never commit `.env` file to version control
- The API key in `.env` should be kept secret
- Scanned repositories are stored temporarily and deleted after analysis
- Use environment variables for all sensitive data

## 📝 License

Part of the Secret Guardian project.

## 🤝 Contributing

1. Ensure Python 3.12+ is installed
2. Create virtual environment
3. Install dependencies
4. Make changes
5. Test thoroughly
6. Submit pull request

## 🆘 Support

For issues or questions, please check:
1. Ensure all dependencies are installed
2. Verify Python version (3.12+)
3. Check `.env` file configuration
4. Review server logs for errors
