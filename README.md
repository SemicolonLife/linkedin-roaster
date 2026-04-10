# 🔥 LinkedIn Roaster

> Your profile called. It wants therapy.

AI-powered LinkedIn profile evaluator for Gen Z. Paste your profile, choose a mode, and get a brutally honest comedic roast + actionable career feedback — powered by Claude AI.

## Features

- **Roast Mode** — sharp, specific comedy about your profile's weakest points
- **Serious Mode** — section-by-section recruiter audit with rewrites
- **Both Mode** — full roast + full audit simultaneously
- **Tone selector** — Gentle / Medium / Full Savage
- **Target role** — personalize feedback to a specific job
- **Share Card** — download/copy a score image for social media
- **Local History** — last 3 analyses saved in your browser
- **Zero login, zero data retention** — privacy first

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite |
| Styling | Tailwind CSS v4 |
| AI | Claude API (claude-sonnet-4-5) |
| Share Card | html2canvas |
| API Proxy | Vercel Edge Function |
| Hosting | Vercel |

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Add your Claude API key

```bash
cp .env.example .env.local
# Edit .env.local and set CLAUDE_API_KEY=sk-ant-...
```

Get your key at [console.anthropic.com](https://console.anthropic.com/)

### 3. Run locally

```bash
npm run dev
```

> **Note:** The `/api/roast` serverless function requires the Vercel CLI for local testing with the API key. For pure frontend dev, use `npm run dev` (the API call will 404 unless you run `vercel dev` instead).

### 4. Run with Vercel CLI (recommended)

```bash
npm install -g vercel
vercel dev
```

## Deployment

```bash
vercel --prod
```

Set `CLAUDE_API_KEY` in your Vercel project environment variables.

## Project Structure

```
src/
  components/
    ProfileInput.jsx     # Input form — mode, tone, role, textarea
    ResultsPanel.jsx     # Overall score + section breakdown
    SectionCard.jsx      # Expandable per-section roast/tips/rewrite
    ScoreRing.jsx        # SVG score ring + bar components
    ShareCard.jsx        # html2canvas share card modal
    HistoryDrawer.jsx    # Slide-in recent analyses drawer
    LoadingScreen.jsx    # Animated loading with witty copy
  lib/
    roastEngine.js       # API wrapper, history, usage tracking
  App.jsx               # Root — state machine, layout
  index.css             # Tailwind base

api/
  roast.js              # Vercel Edge Function — Claude API proxy
```

## Privacy

Profile text is sent to the Claude API for analysis and is **not stored** server-side. The serverless function processes and discards it. Local history is stored only in your browser's localStorage.
