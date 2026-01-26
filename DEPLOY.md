# Deployment Guide - Secret Guardian

This guide covers deploying Secret Guardian with the **frontend on Vercel** and **backend on Render**.

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐
│   Vercel        │  HTTPS  │   Render        │
│   (Frontend)    │ ──────► │   (Backend)     │
│   Next.js       │         │   FastAPI       │
└─────────────────┘         └─────────────────┘
```

---

## Backend Deployment (Render)

### Option 1: Deploy via Render Blueprint (Recommended)

1. **Fork/Push your repository to GitHub**

2. **Go to [Render Dashboard](https://dashboard.render.com/)**

3. **Click "New" → "Blueprint"**

4. **Connect your GitHub repository**

5. **Render will automatically detect `render.yaml`** and configure the service

6. **Set Environment Variables** in Render Dashboard:
   - `GOOGLE_API_KEY`: Your Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
   - `FRONTEND_URL`: Your Vercel frontend URL (set after deploying frontend)

### Option 2: Manual Deployment

1. **Go to [Render Dashboard](https://dashboard.render.com/)**

2. **Click "New" → "Web Service"**

3. **Connect your GitHub repository**

4. **Configure the service:**
   - **Name**: `secret-guardian-api`
   - **Region**: Oregon (or closest to your users)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

5. **Set Environment Variables:**
   - `GOOGLE_API_KEY`: Your Gemini API key
   - `FRONTEND_URL`: Your Vercel frontend URL

6. **Click "Create Web Service"**

### Backend URL
After deployment, your backend URL will be:
```
https://secret-guardian-api.onrender.com
```
(or your custom service name)

---

## Frontend Deployment (Vercel)

### Option 1: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Set Environment Variable in Vercel Dashboard:**
   - Go to your project settings → Environment Variables
   - Add: `NEXT_PUBLIC_API_URL` = `https://your-backend-url.onrender.com`

### Option 2: Deploy via Vercel Dashboard (Recommended)

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**

2. **Click "Add New" → "Project"**

3. **Import your GitHub repository**

4. **Configure the project:**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `next build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

5. **Add Environment Variable:**
   - `NEXT_PUBLIC_API_URL` = `https://secret-guardian-api.onrender.com`

6. **Click "Deploy"**

### Frontend URL
After deployment, your frontend URL will be:
```
https://secret-guardian.vercel.app
```
(or your custom domain)

---

## Post-Deployment Configuration

### Update CORS (Important!)

After deploying the frontend, update the backend's `FRONTEND_URL` environment variable:

1. Go to **Render Dashboard** → Your service → **Environment**
2. Set `FRONTEND_URL` to your Vercel URL (e.g., `https://secret-guardian.vercel.app`)
3. Click **Save Changes** - Render will automatically redeploy

---

## Environment Variables Summary

### Backend (Render)
| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Google Gemini API key for AI suggestions |
| `FRONTEND_URL` | Yes | Vercel frontend URL for CORS |

### Frontend (Vercel)
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Render backend API URL |

---

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` is set correctly in Render (include `https://`, no trailing slash)
- Example: `https://secret-guardian.vercel.app`

### API Connection Failed
- Verify `NEXT_PUBLIC_API_URL` is set in Vercel
- Check that the backend service is running on Render
- Free tier services may sleep after 15 minutes of inactivity

### Build Failures

**Frontend:**
- Ensure all dependencies are in `package.json`
- Check for TypeScript errors: `npm run build` locally

**Backend:**
- Ensure all dependencies are in `requirements.txt`
- Check Python version compatibility (3.11+)

### Cold Start (Free Tier)
Render free tier spins down after inactivity. First request may take 30-60 seconds.

---

## Custom Domain (Optional)

### Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS as instructed

### Render
1. Go to Service Settings → Custom Domain
2. Add your custom domain
3. Configure DNS as instructed

---

## Local Development

For local development, the environment variables are:

**Frontend (`.env.local`):**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Backend (`.env`):**
```
GOOGLE_API_KEY=your_api_key_here
FRONTEND_URL=http://localhost:3000
```
