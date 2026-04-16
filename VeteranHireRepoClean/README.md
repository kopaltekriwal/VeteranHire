# VeteranHire

VeteranHire is a full-stack platform that helps veterans transition into civilian careers through job discovery, resume-based AI matching, skill-gap analysis, and guided upskilling.

This repository currently runs as:
- Backend: Flask + SQLAlchemy (SQLite)
- Frontend: React + Vite

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Core Features](#core-features)
- [Authentication and Authorization](#authentication-and-authorization)
- [Data Model](#data-model)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Run Commands](#run-commands)
- [API Reference](#api-reference)
- [Admin Demo Credentials](#admin-demo-credentials)
- [Performance and Caching Notes](#performance-and-caching-notes)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)
- [Deployment Notes](#deployment-notes)
- [Roadmap](#roadmap)

---

## Overview

VeteranHire provides:

1. Search-first job discovery with filters
2. Resume upload and AI-powered role recommendations
3. Skill-gap analysis and course guidance
4. CV generation (PDF and DOCX)
5. Career guidance assistant
6. Admin analytics and verification workflows

---

## Architecture

### Backend (`backend/flask_app.py`)

- Flask REST API
- SQLAlchemy ORM with SQLite persistence
- JWT-based authentication
- Resume parsing + Gemini-based hybrid analysis
- Adzuna ingestion for job dataset refresh
- Server-side caching for repeated resume processing

### Frontend (`frontend/`)

- React + React Router
- Centralized API client (`src/api.js`) with bearer token injection
- Multi-page interface:
  - Search
  - Job Recommendations
  - Career Guidance / AI Assistant
  - Upskill
  - CV Generator
  - More Websites
  - Admin Dashboard

---

## Tech Stack

### Frontend

- React 18
- Vite 5
- React Router DOM
- Recharts (admin analytics)

### Backend

- Flask 3
- Flask-CORS
- Flask-SQLAlchemy / SQLAlchemy
- Requests
- PyJWT
- bcrypt
- python-docx
- reportlab
- groq (optional chat model)
- google-genai (Gemini integration)

### Database

- SQLite (`veteranhire.db` by default)

---

## Repository Structure

```text
Capstone-VeteranHire/
|- backend/
|  |- flask_app.py            # Main Flask API
|  |- resume_service.py       # Resume AI service integration
|  |- resume_parser.py        # Resume text extraction
|  |- course_service.py       # Course fallback helpers
|  |- seed_demo.py            # Demo data seeding utility
|  |- data/
|     |- jobs.json            # Legacy/static source (if present)
|- frontend/
|  |- package.json
|  |- vite.config.js
|  |- src/
|     |- App.jsx
|     |- api.js
|     |- components/
|     |- pages/
|     |- styles/theme.css
|- requirements.txt
|- README.md
```

---

## Core Features

### 1. Job Search

- DB-backed search via `GET /search_jobs`
- Filters: location, salary range, type, experience
- Pagination in UI (20 jobs per page)
- Duplicate prevention during ingestion

### 2. Job Recommendations

- Resume upload flow
- Hybrid AI + rule-based scoring
- Match %, matched skills, missing skills
- Suggested roles + top matched jobs

### 3. Upskill

- Before analysis: shows randomized 10-course set
- After analysis: shows
  - Matching skills
  - Missing skills
  - Skill-gap-based filtered courses

### 4. CV Generator

- Prefill from latest resume signals
- ATS-oriented scoring
- Export support:
  - PDF (`/generate_pdf`)
  - DOCX (`/generate_docx`)

### 5. More Websites

- Curated external job portals
- Card-based UI with accent tags/strips

### 6. Admin Panel

- User and verification management
- Aggregate stats endpoint
- Category and activity analytics

---

## Authentication and Authorization

### Auth

- `POST /signup` returns `{ token, user }`
- `POST /login` returns `{ token, user }`
- Passwords hashed with bcrypt
- JWT default expiry: 7 days

### Frontend session persistence

- Token stored in localStorage
- User profile stored in localStorage
- API requests auto-attach `Authorization: Bearer <token>`

### Role protection

- Admin routes validate admin role on backend
- Frontend protected routes block non-admin access

---

## Data Model

Primary SQLAlchemy models:

### `User`

- Identity: `id`, `name`, `email`, `password`
- Profile: phone, location, education, military fields
- Security/Access: `role`, `verification_status`

### `ResumeData`

- `resume_text`
- `extracted_skills` (JSON string)
- `matched_jobs` (JSON string)
- `skill_gap` (JSON string)
- `match_score`

### `Job`

- Job metadata: title, company, description, location
- Skill and match fields
- `category`/`type`, salary bands, experience level
- External `link` (unique)

### `Course`

- title/platform/level/duration/rating/skill/link

### `Application`

- user-job mapping for admin analytics
- status + timestamp

---

## Environment Variables

Backend reads:

- `VETERANHIRE_JWT_SECRET` (JWT signing key)
- `VETERANHIRE_DB_DIR` (default SQLite directory)
- `VETERANHIRE_DB_PATH` (full DB path override)
- `VETERANHIRE_UPLOAD_DIR` (uploaded assets/documents)
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default: `gemini-2.0-flash`)
- `GROQ_API_KEY` (optional assistant)
- `GROQ_MODEL`
- `VETERANHIRE_ADMIN_EMAIL` (optional admin auto-role)
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`

Frontend:

- `VITE_API_URL` (default: `http://localhost:8000`)

---

## Getting Started

### 1. Clone and enter project

```powershell
git clone <your-repo-url>
cd Capstone-VeteranHire
```

### 2. Create and activate virtual environment (Windows)

```powershell
python -m venv .venv
.\.venv\Scripts\activate
```

### 3. Install backend dependencies

```powershell
pip install -r requirements.txt
```

### 4. Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

### 5. Configure environment

VeteranHire auto-loads environment variables from a local `.env` file at repo root (no need to export variables in the terminal each run).

Edit `.env` at repo root and fill in your keys.

Minimum required for Adzuna + Gemini:

```env
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
GEMINI_API_KEY=...
VETERANHIRE_JWT_SECRET=...
```

Optional:

```env
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
```

---

## Run Commands

### Backend

```powershell
.\.venv\Scripts\activate
python backend\flask_app.py
```

Backend URL: `http://localhost:8000`

### Frontend

```powershell
cd frontend
npm run dev
```

Frontend URL: typically `http://localhost:5173`

### Optional: seed demo data manually

```powershell
python backend\seed_demo.py
```

---

## API Reference

### Health

- `GET /health`

### Auth

- `POST /signup`
- `POST /login`

### Profile

- `GET /profile/<user_id>`
- `PUT /profile/<user_id>`
- `POST /profile/<user_id>/profile_picture`
- `POST /profile/<user_id>/verification`
- `POST /profile/<user_id>/verification_status`

### Jobs

- `GET /fetch_jobs`
- `GET /search_jobs`
- `POST /recommend_jobs`

### Upskill / Courses

- `POST /generate_courses`
- `GET /get_courses/<user_id>`

### CV

- `GET /cv_prefill/<user_id>`
- `POST /generate_pdf`
- `POST /generate_docx`

### Guidance / Chat

- `POST /career_guidance`
- `POST /chat`

### Admin

- `GET /admin/users`
- `GET /admin/verification_queue`
- `POST /admin/verification/<user_id>`
- `GET /admin/stats`
- `POST /admin/seed_demo_data`

Legacy-style admin APIs used by dashboard compatibility:

- `GET /api/users`
- `GET /api/verification`
- `POST /api/verify/<user_id>`
- `GET /api/admin/user/<user_id>`

---

## Admin Demo Credentials

- Admin: `admin@test.com / admin123`

Common seeded users:
- `user1@test.com / password123`
- `user2@test.com / password123`
- `veteran@test.com / password123`

---

## Performance and Caching Notes

- Job dataset cached in DB and refreshed with configured cadence
- Resume processing uses DB cache via normalized `resume_text`
- Match score capped (`MAX_MATCH_SCORE = 99`)
- API uses one hybrid analysis pass per fresh resume

---

## Troubleshooting

### 1. `ModuleNotFoundError: No module named 'backend'`

Run commands from repo root:

```powershell
python backend\flask_app.py
```

### 2. CORS warnings / blocked requests

Ensure frontend uses `VITE_API_URL=http://localhost:8000` and backend is running.

### 3. `No module named reportlab` or similar

Install all deps:

```powershell
pip install -r requirements.txt
```

### 4. Empty job results

Check Adzuna credentials and call:

```text
GET /fetch_jobs?pages=10
```

### 5. Login not persisting

Confirm browser localStorage contains `token` and `user`.

---

## Security Notes

- Change default `VETERANHIRE_JWT_SECRET` in production
- Never commit API keys
- Consider secure cookies/refresh-token strategy for production auth hardening
- Add server-side rate limits for public endpoints

---

## Deployment Notes

For production, use:

- Flask app behind Gunicorn/uWSGI + reverse proxy (Nginx)
- HTTPS termination
- managed DB volume for SQLite (or migrate to Postgres)
- environment-based secrets injection

---

## Roadmap

- Real-time multi-source job ingestion
- Better semantic/vector matching for skills and roles
- Resume quality scoring with explainability
- Notifications and saved-job workflows
- Audit trail and admin observability enhancements
