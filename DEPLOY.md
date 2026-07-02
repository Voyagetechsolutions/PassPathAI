# Deploying PassPath (free tier, no card needed)

Everything below is free. Total time: ~20 minutes. The repo is already committed
and deployment-ready — `render.yaml` describes both services (API + landing site).

## 1. Push the repo to GitHub (~5 min)

You need a GitHub account (free — github.com/signup). Then, in a terminal:

```bash
cd C:\Users\Mthokozisi.DESKTOP-DPOBCC1\Documents\PassPath
gh auth login          # choose GitHub.com → HTTPS → login with browser
gh repo create passpath --private --source . --push
```

No `gh`? Create an empty **private** repo called `passpath` on github.com, then:

```bash
git remote add origin https://github.com/<your-username>/passpath.git
git push -u origin main
```

## 2. Deploy on Render (~10 min)

1. Sign up free at https://render.com (use "Sign in with GitHub" — no card asked).
2. Click **New +** → **Blueprint** → select your `passpath` repo.
3. Render reads `render.yaml` and shows two services: **passpath-api** and
   **passpath-site**. Before clicking Apply, it asks for the secret env vars.
   Copy each value from `apps/backend/.env` on this machine:

   | Env var | Where to find the value |
   |---|---|
   | `DATABASE_URL` | `apps/backend/.env` |
   | `DIRECT_URL` | `apps/backend/.env` |
   | `OPENAI_API_KEY` | `apps/backend/.env` |
   | `FIREBASE_PROJECT_ID` | `"project_id"` in `apps/backend/firebase-admin.json` |
   | `FIREBASE_CLIENT_EMAIL` | `"client_email"` in `firebase-admin.json` |
   | `FIREBASE_PRIVATE_KEY` | `"private_key"` in `firebase-admin.json` — paste the whole value including `-----BEGIN PRIVATE KEY-----` |
   | `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` | leave blank until you create a Paystack account |

4. Click **Apply**. First build takes ~5 minutes. You'll get two URLs like:
   - API: `https://passpath-api.onrender.com`
   - Site: `https://passpath-site.onrender.com`

5. Verify: open `https://passpath-api.onrender.com/api/health` → should return OK.
   (First hit after idle takes ~50s — free tier wakes from sleep.)

## 3. Point the app at the deployed API (~2 min)

In `apps/mobile/app.json`, change:

```json
"apiBaseUrl": "https://passpath-api.onrender.com/api"
```

(Ask Claude to do this + verify once your URL exists.)

## 4. Later, when ready

- **Paystack**: create the free account, put the test keys into Render's env vars,
  and set the webhook URL to `https://passpath-api.onrender.com/api/subscription/webhook`.
- **Privacy policy URL for Play Store**: `https://passpath-site.onrender.com/privacy.html`.
- **Past-paper downloads on the server**: the 590MB of PDFs live only on this
  machine. To serve them from the cloud, create a free Cloudflare R2 bucket
  (10GB free), upload `apps/backend/storage/`, and set `STORAGE_DRIVER=s3` +
  the `AWS_*` vars on Render (the code already supports S3-compatible storage).
  Until then, everything except the PDF *downloads* works — the AI content is
  in the database, not the PDFs.

## Known free-tier limits

- API sleeps after ~15 min idle; next request takes ~50s. Acceptable for early
  access; upgrade when users complain.
- Neon database is at its 512MB free cap — subscription tables + the last 1.3%
  of AI embeddings are blocked until that's resolved (Neon paid tier, or a new
  project + data migration).
