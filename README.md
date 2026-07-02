# PassPath

Curriculum-aligned exam-preparation platform for South African high-school students (Grades 8–12).

PassPath is **not** a chatbot. It is an exam-training system built around the CAPS
curriculum: diagnostic testing, weakness detection, adaptive practice, grounded AI
explanations (no source → no answer), exam simulation, readiness prediction and
career guidance.

## Architecture

Modular monolith (NestJS) following Clean Architecture + DDD. Each business module is
isolated; all business logic lives in services, never in controllers.

```
passpath/
├─ apps/
│  ├─ backend/        NestJS modular-monolith API (Postgres + Redis + pgvector) ✅
│  ├─ mobile/         React Native (Expo) student app ✅
│  └─ web/            Next.js dashboards (student/parent/admin) ✅
├─ docker-compose.yml DB + cache + backend for local dev
└─ .env.example       Single source of truth for configuration
```

### Frontends

- **Web** (`apps/web`, Next.js App Router + Tailwind): landing, login, student
  dashboard, parent dashboard (link children, view performance), admin panel
  (stats, users, AI settings). Firebase web auth → bearer token → backend.
  `npm install && npm run dev` (port 3001). Production build verified.
- **Mobile** (`apps/mobile`, Expo Router + TS): auth gate, login, bottom tabs —
  performance dashboard, grounded AI Ask, study roadmap (today's missions),
  profile + countdowns. `npm install && npm start`. See [apps/mobile/README.md](apps/mobile/README.md).

### Modules (domain)

| # | Module | Status |
|---|--------|--------|
| 1 | Authentication (Firebase IdP + RBAC) | ✅ implemented |
| 2 | Student Profile | ✅ implemented |
| 3 | CAPS Curriculum Engine (+ ingestion + S3) | ✅ implemented |
| 4 | Diagnostic Test Engine | ✅ implemented |
| 5 | AI Learning Engine (grounded RAG) | ✅ implemented |
| 6 | Question Generation (grounded) | ✅ implemented |
| 7 | Weakness Tracking (mastery + weak topics + mistakes) | ✅ implemented |
| 8 | Study Roadmap | ✅ implemented |
| 9 | Exam Simulation | ✅ implemented |
| 10 | Performance Dashboard (+ streak) | ✅ implemented |
| 11 | Countdown System | ✅ implemented |
| 12 | Career Guidance (APS + eligibility) | ✅ implemented |
| 13 | Parent Dashboard | ✅ implemented |
| 14 | Admin Panel | ✅ implemented |

**Backend: all 14 modules implemented and tested (61 unit + 1 e2e, build + lint clean).**

The full data model for every module is defined in `apps/backend/prisma/schema.prisma`.
Modules are being implemented foundation-first; this README's status column tracks reality.

## Quick start (local)

```bash
cp .env.example .env            # fill in Firebase + OpenAI values
docker compose up -d db redis   # Postgres (pgvector) + Redis
cd apps/backend
npm install
npm run prisma:generate
npm run prisma:migrate           # creates schema
npm run start:dev                # API on http://localhost:3000
# Swagger UI:                     http://localhost:3000/docs
```

Or run everything in containers:

```bash
docker compose up --build
```

## Authentication model

Firebase is the identity provider: it owns passwords, email verification and password
reset. The backend verifies Firebase ID tokens, provisions a local `User` row on first
contact, and owns **roles / RBAC** (`student`, `parent`, `admin`). See
`apps/backend/src/modules/auth`.

## Conventions

- TypeScript `strict`. No `any` in domain code.
- Controllers: HTTP only (validation, status codes, Swagger). Logic → services.
- DTOs validated with `class-validator`; responses shaped by serialization.
- Every module owns its directory under `src/modules/<name>`.
