# Running PassPath

## The short version

| What | Where | How |
|---|---|---|
| Website | https://passpathai-production.up.railway.app/ | Always on — nothing to run |
| API (backend) | same URL, under `/api` | Always on — nothing to run |
| Admin dashboard | https://passpathai-production.up.railway.app/admin.html | Sign in with your own PassPath account |
| Mobile app | your phone (Expo Go) | steps below |

The backend and website run themselves on Railway. The **only** thing you ever
start by hand is the mobile app during development.

## Running the mobile app on your phone

One-time setup: install **Expo Go** from the Play Store on your phone.

Every time:

```powershell
cd C:\Users\Mthokozisi.DESKTOP-DPOBCC1\Documents\PassPath\apps\mobile
npx expo start
```

Wait for the QR code, then scan it with Expo Go (or the phone camera). That's
it — the app talks to the live Railway backend (`apiBaseUrl` in `app.json`),
so it works on any Wi-Fi or mobile data; the laptop only serves the app's code
while you develop.

- Made a code change and the phone looks stale? Shake the phone → **Reload**.
- QR gone from the terminal? Press `c` in the Expo terminal to show it again.
- Stop it with `Ctrl+C` when you're done.

## Admin dashboard

Open **/admin.html** on the site and sign in with your normal PassPath email
and password. Access is limited to emails in the `ADMIN_EMAILS` env var on
Railway (defaults to mthokochaza@gmail.com). It shows users, engagement,
tutor usage, revenue, database size, and lets you suspend/reactivate accounts.

## Changing things without code

Set these on Railway (service → Variables) and redeploy happens automatically:

| Env var | What it does | Default |
|---|---|---|
| `FREE_TUTOR_MESSAGES` | Free-trial tutor messages (lifetime) | 5 |
| `FREE_MOCK_EXAMS` | Free-trial mock exams (lifetime) | 1 |
| `PAYSTACK_MONTHLY_AMOUNT_CENTS` | Premium price, in cents | 20000 (R200) |
| `ADMIN_EMAILS` | Comma-separated admin emails | mthokochaza@gmail.com |
| `AI_API_KEY` + `AI_BASE_URL` + `AI_CHAT_MODEL` | Switch the chat AI to a free provider (see below) | uses OpenAI |

## Free AI providers for the tutor

The tutor can run on any OpenAI-compatible API. Two genuinely free options:

**Groq (recommended — fast, generous free tier):**
1. Sign up free at https://console.groq.com and create an API key.
2. On Railway set:
   - `AI_API_KEY` = your Groq key
   - `AI_BASE_URL` = `https://api.groq.com/openai/v1`
   - `AI_CHAT_MODEL` = `llama-3.3-70b-versatile`

**Google Gemini (free tier ~1,500 requests/day):**
1. Get a key at https://aistudio.google.com/apikey.
2. On Railway set:
   - `AI_API_KEY` = your Gemini key
   - `AI_BASE_URL` = `https://generativelanguage.googleapis.com/v1beta/openai/`
   - `AI_CHAT_MODEL` = `gemini-2.0-flash`

Keep `OPENAI_API_KEY` set either way: embeddings (the search that grounds the
tutor in the past papers) must stay on OpenAI because all stored vectors were
made with its embedding model. Embeddings cost almost nothing (cents/month) —
it's the chat calls that cost, and those are what the free provider replaces.

## Running the backend locally (rarely needed)

```powershell
cd C:\Users\Mthokozisi.DESKTOP-DPOBCC1\Documents\PassPath\apps\backend
npm start
```

Runs on http://localhost:3000 (website at /, API at /api). Uses `.env` in
`apps/backend`. Stop with `Ctrl+C`. You don't need this for normal use — the
phone app points at Railway.

## Deploying changes

```powershell
cd C:\Users\Mthokozisi.DESKTOP-DPOBCC1\Documents\PassPath
git add -A
git commit -m "describe the change"
git push
```

Railway and Vercel both redeploy automatically from every push to `main`.
