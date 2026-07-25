# Deploying PassPath (AWS Lightsail)

Production runs on **one AWS Lightsail instance** ($7/month: 2 vCPU, 1GB RAM,
40GB SSD, 2TB transfer). Docker Compose runs four containers on it:

| Container | Role |
|---|---|
| `passpath-backend` | NestJS API + marketing site (same image, `apps/backend/Dockerfile`) |
| `passpath-db` | Postgres 18 with pgvector + pgcrypto (replaces Neon — no 512MB cap) |
| `passpath-redis` | Cache (optional for the app, free to run here) |
| `passpath-caddy` | HTTPS reverse proxy — automatic TLS certificates |

The curriculum and past-paper PDFs live in a private Amazon S3 bucket. The
instance holds only PostgreSQL, Redis and the API, so the content library can
grow without consuming the server disk.

**Monthly cost: ~$7.10** ($7 instance + pennies for S3 backups).

---

## 1. Create the instance (AWS console, ~10 min)

1. Sign up / sign in at <https://aws.amazon.com> (needs a card; new accounts get
   free-tier credits).
2. Go to **Lightsail** (search "Lightsail" in the console) → **Create instance**.
3. Region: **London (eu-west-2)** — Lightsail has no Cape Town region; London is
   the closest.
4. Platform **Linux/Unix** → Blueprint **OS Only → Ubuntu 24.04 LTS**.
5. Plan: **$7/month (1GB RAM, 2 vCPU, 40GB SSD)**. 512MB is too small for
   Postgres + Node + Docker builds.
6. Name it `passpath` → **Create instance**.
7. **Networking tab** of the instance:
   - Create + attach a **static IP** (free while attached).
   - Under firewall, **add HTTPS (443)** — 22 and 80 are open by default.

## 2. Connect

Easiest: the **browser SSH terminal** (orange "Connect" button on the instance
page). Or from PowerShell: download the default SSH key from Lightsail →
**Account → SSH keys**, then:

```bash
ssh -i LightsailDefaultKey-eu-west-2.pem ubuntu@<STATIC_IP>
```

## 3. Set up the box (one-time)

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit   # reconnect so the group applies

# 2GB swap — the image build (TypeScript compile) needs it on a 1GB box
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Code (use a GitHub personal access token if the repo is private)
git clone https://github.com/<your-username>/PassPath.git
cd PassPath
```

Create `.env` in the repo root on the server (`nano .env`):

```
POSTGRES_PASSWORD=<long random string>
AUTH_TOKEN_SECRET=<same value as on Railway, so existing logins keep working>
OPENAI_API_KEY=<key>
# DOMAIN=passpath.co.za www.passpath.co.za   # uncomment once DNS points here
# PAYSTACK_SECRET_KEY= / PAYSTACK_PUBLIC_KEY=   # when live
```

## 4. Migrate the database off Neon

Start **only Postgres** first (restoring into a fresh DB, before the app runs
its migrations):

```bash
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump "<NEON_DIRECT_URL>" | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U passpath passpath
```

(pg_dump refuses if its version is older than the server's — the compose file
pins `pgvector/pgvector:pg18` to match Neon's Postgres 18.)

This also un-blocks the two things the 512MB Neon cap was holding up: run the
subscription migrations and the last embeddings backfill afterwards.

## 5. Create S3 and upload the PDFs

Create the private content bucket, IAM policy and API credentials, then
synchronise the existing files by following `infra/aws/README.md`. Add these
values to the root `.env` on the Lightsail instance:

```text
AWS_REGION=eu-west-2
AWS_S3_BUCKET=<BucketName output>
AWS_ACCESS_KEY_ID=<dedicated IAM user key>
AWS_SECRET_ACCESS_KEY=<dedicated IAM user secret>
```

## 6. Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
curl http://localhost/api/health
```

Then check `http://<STATIC_IP>/` in a browser — site and API should be up
(plain HTTP until the domain is attached).

## 7. Domain + HTTPS

1. At your registrar, point the domain (A record, apex + `www`) at the static IP.
   If the site currently fronts through Vercel, either update `vercel.json`'s
   proxy target to the new box or drop Vercel and go direct.
2. Uncomment `DOMAIN=...` in `.env`, then `docker compose -f docker-compose.prod.yml up -d`.
   Caddy fetches TLS certificates automatically once DNS resolves.
3. Update the Paystack webhook URL: `https://<domain>/api/subscription/webhook`.
4. Update `apps/mobile/app.json` (`apiBaseUrl`) if the API URL changed.

## 8. Backups (do not skip)

Nightly `pg_dump` to S3 — setup instructions are at the top of
[deploy/backup-db.sh](deploy/backup-db.sh) (S3 bucket + lifecycle rule + cron).
Optionally also enable Lightsail **automatic snapshots** on the instance
(~$1–2/month) for whole-box recovery.

## Redeploying after a code change

```bash
cd ~/PassPath && git pull
docker compose -f docker-compose.prod.yml up -d --build backend
```

(Migrations run automatically on container start.)

## Retiring the old stack

Once the domain serves from AWS and a backup has landed in S3: delete the
Railway service and the Neon project. `render.yaml` remains as a free-tier
fallback description.

## Env vars reference

Required: `POSTGRES_PASSWORD`, `AUTH_TOKEN_SECRET`, `OPENAI_API_KEY`,
`AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`.
Optional: `DOMAIN`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`,
`PREMIUM_PRICE_CENTS` (defaults to `9900` = R99/month).
`DATABASE_URL`/`DIRECT_URL`/`REDIS_*`/`STORAGE_*` are set by
`docker-compose.prod.yml` — don't put them in `.env`.
