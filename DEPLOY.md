# Deploying PassPath

Production runs on **Railway** as ONE service: the website and the API are the
same deployment. Every push to `main` on GitHub redeploys automatically.

| What | URL |
|---|---|
| Website (landing page) | `https://passpathai-production.up.railway.app/` |
| Privacy policy (Play Store needs this) | `https://passpathai-production.up.railway.app/privacy.html` |
| API | `https://passpathai-production.up.railway.app/api` |
| API health check | `https://passpathai-production.up.railway.app/api/health` |
| API docs (Swagger) | `https://passpathai-production.up.railway.app/docs` |

The site's files live in `apps/backend/public/` — edit `index.html` there and
push; the live site updates on the next deploy. No separate hosting, no second
service to keep in sync.

## Vercel (domain front)

The repo also deploys on Vercel via `vercel.json`: Vercel publishes
`apps/backend/public` as a static site (no build) and proxies `/api/*` and
`/docs` through to the Railway backend. Attach your custom domain to the
Vercel project and the whole site — pages **and** API — works on that domain.
Nothing to configure in the Vercel dashboard; the file does it all.

## Connecting your custom domain directly to Railway (alternative, ~10 min)

1. Railway dashboard → the **passpathai** service → **Settings** → **Networking**
   → **Custom Domain** → enter your domain (e.g. `passpath.co.za`, and add
   `www.passpath.co.za` too).
2. Railway shows a **CNAME** value. At your domain registrar, add a CNAME record
   pointing your domain at that value. (For a root/apex domain, use the
   registrar's ALIAS/ANAME/CNAME-flattening option, or put the site on `www`
   and redirect the apex.)
3. Wait for DNS (minutes to a few hours). Railway issues the HTTPS certificate
   automatically.
4. After the domain is live, do a find-and-replace of
   `passpathai-production.up.railway.app` → your domain in:
   - `apps/mobile/app.json` (`apiBaseUrl`)
   - `marketing/social-content-pack.md`
   The old Railway URL keeps working either way.

## Env vars (already set on Railway)

`DATABASE_URL`, `DIRECT_URL`, `OPENAI_API_KEY`, `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `NODE_ENV=production`.

Set later when ready:
- `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` — from your Paystack dashboard.
  Webhook URL: `https://<your-domain>/api/subscription/webhook`.
- `PREMIUM_PRICE_CENTS` — defaults to `9900` (R99/month) in code.

## Still pending

- **Past-paper PDF downloads**: the 590MB of PDFs live only on the dev machine.
  To serve them from the cloud, create a free Cloudflare R2 bucket (10GB free),
  upload `apps/backend/storage/`, and set `STORAGE_DRIVER=s3` + the `AWS_*`
  vars. Everything except the PDF *downloads* already works — the AI content is
  in the database, not the PDFs.
- **Neon database** is at its 512MB free cap — subscription tables + the last
  1.3% of AI embeddings are blocked until that's resolved (Neon paid tier, or a
  new project + data migration).

## Backup option

`render.yaml` still describes an equivalent single-service deploy on Render's
free tier if Railway ever needs replacing.
