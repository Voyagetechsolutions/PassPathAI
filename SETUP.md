# PassPath — Full Wiring Guide

Everything end to end: database → backend → AI → web → mobile. Follow top to
bottom. Steps marked **(optional)** are only needed for real Firebase auth or
your own curriculum content.

Ports: backend API `3000`, web `3001`, Expo dev server `8081`.

---

## 0. Prerequisites (install once)

| Tool | Why | Get it |
|------|-----|--------|
| **Docker Desktop** | Postgres (with pgvector) + Redis | https://www.docker.com/products/docker-desktop/ |
| **Node 18+** (you have 25) | runs everything | already installed |
| **Expo Go (SDK 54)** on your phone | run the mobile app | App Store / Play Store |
| **OpenAI API key** *(optional)* | the AI tutor + question generation | https://platform.openai.com/api-keys |
| **Firebase project** *(optional)* | real email/password auth | https://console.firebase.google.com |

> You do **not** need Firebase or OpenAI to see the app working — demo accounts
> log in without Firebase, and only the AI features need OpenAI.

After installing Docker Desktop, **launch it** and wait for "Engine running".

---

## 1. Configure environment

### Backend — `apps/backend/.env`

```bash
cp .env.example apps/backend/.env
```

Then open `apps/backend/.env` and confirm/set:

```ini
DATABASE_URL=postgresql://passpath:passpath@localhost:5432/passpath?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379

# Demo login (no Firebase needed)
ENABLE_DEV_AUTH=true
DEMO_PASSWORD=passpath-demo

# AI (optional — leave blank to skip AI features)
OPENAI_API_KEY=sk-...
```

### Web — `apps/web/.env.local`

```bash
cp apps/web/.env.example apps/web/.env.local
```

Defaults already point at `http://localhost:3000/api` and the demo password.
Firebase vars can stay blank for demo mode.

### Mobile — `apps/mobile/app.json` → `expo.extra`

Set `apiBaseUrl` to your machine's **LAN IP** (not `localhost`, because the phone
is a different device). Find it with `ipconfig` (look for IPv4):

```json
"extra": {
  "apiBaseUrl": "http://192.168.X.X:3000/api"
}
```

---

## 2. Start the database + cache

From the repo root:

```bash
docker compose up -d db redis
docker compose ps        # both should be "healthy"
```

This runs Postgres with the **pgvector** extension available and Redis.

---

## 3. Backend: schema, data, run

```bash
cd apps/backend
npm install
npm run prisma:generate
npm run prisma:migrate        # creates all tables, FKs, indexes + CREATE EXTENSION vector
npm run db:seed               # base curriculum (Maths G10, a question, a career)
npm run db:seed:demo          # demo accounts + sample performance data + AI knowledge
npm run start:dev             # API on http://localhost:3000  (Swagger: /docs)
```

Verify:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","db":true,...}   ← db must be true
```

**Demo accounts** (password `passpath-demo`):
`student@demo.passpath.app` · `parent@demo.passpath.app` · `admin@demo.passpath.app`

---

## 4. Wire the AI engine (optional, needs `OPENAI_API_KEY`)

The demo seed inserted curriculum chunks but they have no embeddings yet. Embed
them, then ask a grounded question.

```bash
# 1. Get an admin token from dev login
ADMIN=$(curl -s -X POST http://localhost:3000/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.passpath.app","password":"passpath-demo"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 2. Backfill embeddings for all knowledge chunks
curl -s -X POST http://localhost:3000/api/ai/embeddings/backfill \
  -H "Authorization: Bearer $ADMIN"
# -> {"embedded": 3}

# 3. Ask as the student (grounded answer)
STUDENT=$(curl -s -X POST http://localhost:3000/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@demo.passpath.app","password":"passpath-demo"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s -X POST http://localhost:3000/api/ai/ask \
  -H "Authorization: Bearer $STUDENT" -H "Content-Type: application/json" \
  -d '{"question":"How do I factorise x² − 9?","subjectCode":"MATH-G10"}'
# -> grounded explanation with citations. Ask something off-syllabus and it refuses.
```

### Add your own curriculum (optional)

```bash
# Upload a PDF/text file, then ingest + backfill
curl -X POST http://localhost:3000/api/curriculum/documents \
  -H "Authorization: Bearer $ADMIN" \
  -F "file=@/path/to/caps-maths-g10.pdf" -F "title=CAPS Maths G10" -F "subjectCode=MATH-G10" -F "grade=10"
# returns {id}; then:
curl -X POST http://localhost:3000/api/curriculum/documents/<id>/ingest -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:3000/api/ai/embeddings/backfill -H "Authorization: Bearer $ADMIN"
```

You can generate questions the same way: `POST /api/questions/generate`
(`{ "topicId": "...", "type": "MULTIPLE_CHOICE", "difficulty": "EASY", "count": 5 }`).

---

## 5. Web dashboard

```bash
cd apps/web
npm install
npm run dev            # http://localhost:3001
```

Open http://localhost:3001/login → click **Demo Student / Parent / Admin**.

---

## 6. Mobile app (Expo Go, SDK 54)

```bash
cd apps/mobile
npm install
npx expo start         # scan the QR with Expo Go (SDK 54)
```

On the login screen tap a **Demo account** button. (Make sure
`expo.extra.apiBaseUrl` is your LAN IP and the backend is running.)

---

## 7. (Optional) Real Firebase auth instead of demo

1. Firebase console → create project → **Authentication → Sign-in method →
   enable Email/Password**.
2. **Web SDK config** (Project settings → General → Your apps → Web): put the
   values in `apps/web/.env.local` (`NEXT_PUBLIC_FIREBASE_*`) and in
   `apps/mobile/app.json` → `expo.extra.firebase`.
3. **Admin SDK** (Project settings → Service accounts → Generate key): put
   `project_id`, `client_email`, `private_key` into `apps/backend/.env`
   (`FIREBASE_*`), or point `FIREBASE_SERVICE_ACCOUNT_PATH` at the JSON file.
4. Set `ENABLE_DEV_AUTH=false` to disable demo login.
5. New users sign up in Firebase, then call `POST /api/auth/register` with the
   ID token to provision their PassPath profile.

---

## 8. One-shot quickstart (after prerequisites + env files)

```bash
# from repo root
docker compose up -d db redis
cd apps/backend && npm install && npm run prisma:generate && npm run prisma:migrate && npm run db:seed && npm run db:seed:demo && npm run start:dev &
cd ../web && npm install && npm run dev &
cd ../mobile && npm install && npx expo start
```

---

## Troubleshooting

- **`/health` shows `db:false`** → DB not up or `DATABASE_URL` wrong. Check
  `docker compose ps` and that the URL host is `localhost` for local runs.
- **`relation "users" does not exist`** → run `npm run prisma:migrate`.
- **`CREATE EXTENSION "vector"` fails** → you're not on the pgvector image. Use
  `docker compose` (image `pgvector/pgvector:pg16`), not a plain Postgres.
- **AI returns "I don't have curriculum material…"** → no embedded chunks. Run
  `db:seed:demo` then the backfill in step 4 (needs `OPENAI_API_KEY`).
- **Phone can't reach the API** → use your LAN IP in `app.json`, ensure the PC
  firewall allows port 3000, and that phone + PC are on the same Wi-Fi.
- **Dev login says "Dev auth is disabled"** → set `ENABLE_DEV_AUTH=true` and
  restart the backend.
