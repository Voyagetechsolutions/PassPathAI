# PassPath API

NestJS API backed by AWS-hosted PostgreSQL through Prisma. Authentication credentials
are stored as `scrypt` password hashes in the `users` table, and the API issues
signed access tokens for protected routes.

## Run locally

Configure the root `.env` with `DATABASE_URL`, `DIRECT_URL`, and a random
`AUTH_TOKEN_SECRET` of at least 32 characters, then run:

```bash
npm install
npx prisma migrate deploy
npm run start:dev
```

## Authentication

- `POST /api/auth/register` creates the account and profile in PostgreSQL and returns
  `{ token, user }`.
- `POST /api/auth/login` verifies the stored password hash and returns a session.
- Send `Authorization: Bearer <token>` to protected routes.
- `POST /api/auth/logout` lets clients end their local session.

Routes marked `@Public()` bypass the global `AuthGuard`; `RolesGuard` enforces
role metadata after authentication.
