# PassPath setup

## Prerequisites

- Node.js 22
- The AWS PostgreSQL database from the production stack
- Redis is optional; the API degrades gracefully without it
- An OpenAI API key is required only for AI features

## Backend

1. Copy `.env.example` to `.env`.
2. Set the application PostgreSQL URL as `DATABASE_URL` and a migration-capable URL as
   `DIRECT_URL`.
3. Generate a unique `AUTH_TOKEN_SECRET` with at least 32 random characters.
4. Run:

```bash
cd apps/backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

The API runs at `http://localhost:3000/api`.

## Web

```bash
cd apps/web
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL` if the backend is not at the default local URL.

## Mobile

```bash
cd apps/mobile
npm install
npm start
```

Set `expo.extra.apiBaseUrl` in `app.json` for production builds. Registration and
sign-in are handled by the backend and persisted in PostgreSQL.

## Demo accounts

In non-production environments, set `ENABLE_DEV_AUTH=true`, run
`npm run db:seed:demo`, and use the password from `DEMO_PASSWORD`.
