# Demo Credentials & Dev Auth

PassPath includes a **dev-only authentication path** that allows you to demo the platform without setting up Firebase. This is strictly for development and is automatically disabled in production.

## Quick Start

### 1. Enable Dev Auth (Backend)

In your backend `.env`:

```env
ENABLE_DEV_AUTH=true
DEMO_PASSWORD=passpath-demo
```

### 2. Seed Demo Data

Run the demo seed to create three ready-to-use accounts with realistic data:

```bash
cd apps/backend
npm run db:seed-demo
```

This creates:
- **Student Account**: `student@demo.passpath.app` (Grade 10, Mathematics enrolled)
- **Parent Account**: `parent@demo.passpath.app` (linked to the student)
- **Admin Account**: `admin@demo.passpath.app` (full admin access)

All accounts use the password defined in `DEMO_PASSWORD` (default: `passpath-demo`).

### 3. Configure Web App (Optional)

In your web `.env` (optional, defaults to `passpath-demo`):

```env
NEXT_PUBLIC_DEMO_PASSWORD=passpath-demo
```

### 4. Login

#### Option A: One-Click Demo Login (Web)

Visit the login page at `http://localhost:8080/login` and click one of the demo account buttons:
- Demo Student Account
- Demo Parent Account  
- Demo Admin Account

#### Option B: One-Click Demo Login (Mobile)

1. Update `apps/mobile/app.json` → `expo.extra.apiBaseUrl` to your machine's LAN IP:
   ```json
   "apiBaseUrl": "http://192.168.x.x:3000/api"
   ```
   ⚠️ **Important:** Use your actual LAN IP, NOT `localhost` (the phone can't reach `localhost`)

2. Start Expo:
   ```bash
   cd apps/mobile
   npm install
   npx expo start
   ```

3. Scan the QR code with Expo Go (SDK 54)

4. On the login screen, tap one of the demo account buttons

#### Option C: API Direct

```bash
curl -X POST http://localhost:3000/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@demo.passpath.app","password":"passpath-demo"}'
```

Response:
```json
{
  "token": "dev:u-abc123",
  "user": {
    "id": "u-abc123",
    "email": "student@demo.passpath.app",
    "role": "student",
    "studentProfileId": "sp-xyz789"
  }
}
```

Use the `token` as a Bearer token in subsequent API requests:

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer dev:u-abc123"
```

## What Gets Created

The demo seed creates a realistic dashboard experience:

**Curriculum:**
- Mathematics (Grade 10) with two topics:
  - Algebraic Expressions (weak topic for demo student)
  - Euclidean Geometry (strong topic for demo student)

**Student Data:**
- Topic mastery: 90% on Geometry, 40% on Algebra
- Study streak: 4 days current, 9 days longest
- Prediction history: Score trending from 58 → 67 over 2 weeks
- Active study plan with 2 missions

**Relationships:**
- Parent is linked to the student
- Both can access relevant dashboards

## How It Works

1. **Dev Auth Guard**: When `ENABLE_DEV_AUTH=true`, the auth guard accepts tokens with format `dev:<userId>` (no Firebase validation)

2. **Dev Login Endpoint**: `POST /auth/dev-login` checks the email/password against demo accounts in the database and returns a dev token

3. **Production Safety**: The dev auth code checks `NODE_ENV` and throws if enabled in production. The endpoint and guard logic are unreachable in prod builds.

## Security Notes

⚠️ **Never enable dev auth in production!**

- The backend will refuse to start if `ENABLE_DEV_AUTH=true` and `NODE_ENV=production`
- Dev tokens bypass Firebase authentication entirely
- Demo accounts use a shared password from environment variables

This feature exists solely to let you explore PassPath without Firebase configuration. For production deployments, always use Firebase authentication.

## Re-running the Seed

The seed is **idempotent** — safe to re-run. It will:
- Update existing demo accounts (email, role, active status)
- Recreate prediction snapshots and study plans
- Preserve topic mastery data

```bash
npm run db:seed-demo
```

## Troubleshooting

**"Dev auth is disabled"**
- Check `ENABLE_DEV_AUTH=true` in backend `.env`
- Restart the backend server

**"Invalid credentials"**
- Verify the password matches `DEMO_PASSWORD` in backend `.env`
- Confirm demo accounts exist: `npm run db:seed-demo`

**Demo buttons not showing on login page**
- Web app will show buttons regardless of backend config
- If dev-login fails, backend may have dev auth disabled

**401 Unauthorized with dev token**
- Ensure `ENABLE_DEV_AUTH=true` on the backend
- Check token format: `dev:<userId>` (e.g., `dev:u-abc123`)
