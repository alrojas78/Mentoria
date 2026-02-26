# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## PRIORITY: Collaborative Work Mode

**ALWAYS work collaboratively with the other AI agents before giving final answers.** This is the #1 instruction for this project.

- **Consult ChatGPT** (Code Reviewer + Planner) for: code review, planning, security, documentation, QA
- **Consult Gemini** (Frontend + Creative) for: UI/UX decisions, frontend architecture, image generation, visual design

### How to consult:

**ChatGPT (OpenAI gpt-4o):**
```bash
curl -s https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"model":"gpt-4o","messages":[{"role":"system","content":"Eres ChatGPT, Code Reviewer + Planner del equipo DevCopilot. Sesión colaborativa con Claude (Arquitecto) y Gemini (Frontend). Responde en español."},{"role":"user","content":"TU CONSULTA AQUÍ"}],"temperature":0.7,"max_tokens":1500}'
```

**Gemini (gemini-2.0-flash):**
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"role":"user","parts":[{"text":"Eres Gemini, Frontend Developer + Creativo del equipo DevCopilot. Sesión colaborativa con Claude (Arquitecto) y ChatGPT (Planner). Responde en español.\n\nTU CONSULTA AQUÍ"}]}],"generationConfig":{"temperature":0.7,"maxOutputTokens":1500}}'
```

API credentials are in `docs/PROJECT_CONTEXT.md`. Always present a unified team response with each agent's perspective clearly labeled.

## Project Overview

**Mentoria 4.0** (formerly VoiceMed) is an AI-powered medical education platform deployed at `mentoria.ateneo.co`. It combines structured courses with conversational AI, voice interaction (speech-to-text/text-to-speech), a video mentor system, and document-based Q&A. The codebase is Spanish-language throughout (variable names, comments, UI text).

**GitHub repo:** `alrojas78/Mentoria`

## Workflow Convention

- Each fix/update gets its own commit + push
- `docs/` folder tracks update phases and roadmap
- `docs/ROADMAP.md` is kept updated at each stage to maintain cross-conversation context

## Repository Structure

```
Mentoria/
├── frontend/          # React 18 SPA (Create React App)
│   └── src/
│       ├── pages/         # Route-level components
│       ├── components/    # Reusable UI components
│       ├── contexts/      # AuthContext, VoiceContext (React Context API)
│       ├── services/      # API client layer (axios-based, see api.js)
│       └── utils/         # deviceDetector, tokenValidator
├── backend/           # PHP REST API
│   ├── api/               # Endpoint files (one PHP file per resource)
│   │   ├── admin/         # Admin-only endpoints
│   │   ├── mentor/        # Video mentor endpoints
│   │   └── analytics/     # Usage analytics endpoints
│   ├── models/            # Data access classes (User, Course, Module, etc.)
│   ├── utils/             # Service classes (OpenAIService, PollyService, etc.)
│   ├── middleware/        # AuthMiddleware (JWT validation)
│   ├── config/            # config.php (env loader), db.php (PDO MySQL)
│   └── db/                # voicemed.sql schema
├── docs/              # Phase documentation and roadmap
│   ├── ROADMAP.md         # Current status and planned phases
│   └── FASE-*.md          # Per-phase detail docs
```

## Build & Development Commands

### Frontend (from `frontend/`)
```bash
npm start          # Dev server on port 3000
npm run build      # Production build to build/
npm test           # Jest test runner (interactive watch mode)
npm test -- --watchAll=false   # Run tests once (CI mode)
```

### Backend
- No build step; PHP files are served directly by Apache
- Dependencies: `composer install` (from `backend/`)
- Database: Import `backend/db/voicemed.sql` into MySQL

### Linting
- Frontend uses CRA's built-in ESLint config (`react-app`, `react-app/jest`)
- No separate lint command; warnings appear during `npm start` and `npm run build`

## Architecture Details

### Frontend API Layer
All API calls go through `src/services/api.js`, which exports named service objects (`authService`, `courseService`, `consultaService`, `voiceService`, etc.). Axios interceptors automatically attach JWT tokens from localStorage and handle 401 responses with session expiration + redirect to `/login`.

**API base URL** is hardcoded: `https://mentoria.ateneo.co/backend/api`

### Backend API Pattern
Each PHP endpoint file in `api/` is standalone — it includes config, validates auth via `AuthMiddleware`, reads JSON input from `php://input`, and returns JSON. CORS headers are set per-file. Authentication uses JWT (Firebase PHP-JWT library) with 24-hour token expiration.

Key AuthMiddleware methods:
- `AuthMiddleware::requireAuth()` — returns user data or exits 401
- `AuthMiddleware::requireAdmin()` — returns user data or exits 403
- `AuthMiddleware::optionalAuth()` — returns user data or null

### iOS-Specific Components
Device detection (`utils/deviceDetector.js`) routes iOS users to dedicated component variants: `ConsultaAsistenteiPhone`, `VoiceTestiPhone`, `VideoMentorPopupiPhone`. These provide iOS-optimized UIs for the same functionality.

### AI Service Integration
- **OpenAI GPT** — conversational Q&A, question generation, semantic answer evaluation (`utils/OpenAIService.php`, `SemanticEvaluator.php`, `QuestionGenerator.php`)
- **AWS Polly** — primary text-to-speech (`utils/PollyService.php`)
- **ElevenLabs** — alternative TTS provider (`utils/ElevenLabsService.php`)
- **OpenAI Whisper** — speech-to-text transcription (`api/whisper.php`, `services/whisperService.js`)
- **Prompt construction** — `MentorPromptBuilder.php` and `ConversationalPromptBuilder.php` build context-aware prompts

### Key Complex Files
- `backend/api/consulta.php` (~199KB) — the main document Q&A endpoint, handles conversation flow, intent detection, mentor mode, attachments
- `backend/utils/MentorPromptBuilder.php` (~32KB) — constructs AI mentor personality and context
- `backend/utils/RetoService.php` (~28KB) — weekly challenge system

### State Management
Frontend uses React Context (not Redux):
- `AuthContext` — user auth state, token, login/logout
- `VoiceContext` — voice/audio feature state

### Database
MySQL via PDO. Connection configured in `config/db.php` using env vars (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`). All queries use prepared statements.

## Environment Variables

Both `frontend/.env` and `backend/.env` are gitignored. Backend requires:
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `AWS_REGION`
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`

## Key Conventions

- Codebase is in **Spanish**: variable names, comments, API responses, and UI text are all in Spanish
- Backend uses PSR-4 autoloading with `VoiceMed\\` namespace root
- Frontend routing uses React Router v6 with `<ProtectedRoute>` wrapper for auth-required pages
- Styled-components for CSS-in-JS styling
- PHP dependencies: aws-sdk-php, firebase/php-jwt, vlucas/phpdotenv, dompdf/dompdf
