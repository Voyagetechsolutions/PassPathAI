# PassPath Backend

NestJS modular monolith. Clean Architecture + DDD. Each domain module lives under
`src/modules/<name>` and owns its controllers, services, DTOs and guards. All
business logic is in services; controllers handle HTTP only.

## Layout

```
src/
├─ main.ts                 Bootstrap: helmet, CORS, validation, Swagger
├─ app.module.ts           Root wiring + global guards (auth → throttle → RBAC)
├─ config/                 Typed configuration + env validation
├─ infra/                  Cross-cutting infrastructure (global modules)
│  ├─ prisma/              PrismaService (single connection pool)
│  ├─ redis/               RedisService (cache helpers)
│  └─ firebase/            FirebaseService (ID-token verification = IdP)
├─ common/                 Decorators, guards, filters, shared types
│  ├─ decorators/          @Public, @Roles, @CurrentUser
│  ├─ guards/              RolesGuard (RBAC)
│  └─ filters/             AllExceptionsFilter (Prisma-aware envelope)
└─ modules/
   ├─ auth/                Module 1 — Firebase IdP + RBAC
   └─ health/             Liveness/readiness probe
```

## Security model

- **Authentication**: every route is protected by `FirebaseAuthGuard` (global).
  Opt out per-route with `@Public()`. The guard verifies the Firebase ID token
  and loads the local `User` (+ profile ids) onto `request.user`.
- **RBAC**: `@Roles(Role.admin)` etc., enforced by the global `RolesGuard`.
- **Rate limiting**: global `ThrottlerGuard` (configurable via env).
- **Hardening**: `helmet`, strict CORS allowlist, `ValidationPipe`
  (`whitelist` + `forbidNonWhitelisted`).

## Commands

```bash
npm install
npm run prisma:generate     # generate the typed client
npm run prisma:migrate      # create/apply dev migrations
npm run db:seed             # seed reference data
npm run start:dev           # watch mode → http://localhost:3000
npm run build               # compile to dist/
npm test                    # unit tests
npm run test:e2e            # e2e tests
npm run lint                # eslint --fix
```

Swagger UI: `http://localhost:3000/docs`.

## Auth flow (Firebase as IdP)

1. Client signs up / logs in with Firebase (email + password) → receives an ID token.
2. New users call `POST /api/auth/register` with the token + profile fields; the
   backend provisions a local `User` + `StudentProfile`/`ParentProfile`.
3. Subsequent requests send `Authorization: Bearer <firebase-id-token>`.
4. Email verification and password reset are handled by Firebase on the client;
   the backend reflects `emailVerified` from the verified token.

## Adding a module

Copy the `auth` module shape: `dto/`, `<name>.service.ts` (all logic),
`<name>.controller.ts` (HTTP only), `<name>.module.ts`. Register it in
`app.module.ts`. Reuse `PrismaService`, `RedisService`, and the common
decorators/guards — do not re-implement cross-cutting concerns.
