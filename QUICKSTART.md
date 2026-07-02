# PassPath Quick Start Guide

This guide will help you get PassPath running quickly with demo credentials (no Firebase setup required).

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js (v18 or later)
- ✅ PostgreSQL (running on port 5432)
- ✅ Redis (running on port 6379)
- ⚠️ Firebase (optional for dev mode)
- ⚠️ OpenAI API key (optional for dev mode)

**🪟 Windows users without Docker?** See [SETUP-WINDOWS.md](SETUP-WINDOWS.md) for detailed installation instructions.

## Step-by-Step Setup

### 1. Stop Existing Backend (if running)

If you see "port 3000 already in use", stop the existing process:

**Windows:**
```bash
# Find the process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with the number from above)
taskkill /PID 5524 /F
```

**macOS/Linux:**
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9
```

### 2. Start PostgreSQL & Redis

**Option A: Using Docker Compose (Recommended)**

```bash
# From the project root
docker-compose up -d db redis
```

**Option B: Manual Setup**

- Ensure PostgreSQL is running on `localhost:5432`
- Ensure Redis is running on `localhost:6379`
- Update backend `.env` if using different ports/credentials

### 3. Configure Backend Environment

```bash
cd apps/backend

# Copy example env if you haven't already
copy .env.example .env

# Edit .env and ensure these are set:
# ENABLE_DEV_AUTH=true
# DEMO_PASSWORD=passpath-demo
# DATABASE_URL=postgresql://passpath:passpath@localhost:5432/passpath
# REDIS_HOST=localhost
```

**Minimum required .env for demo:**
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://passpath:passpath@localhost:5432/passpath
REDIS_HOST=localhost
ENABLE_DEV_AUTH=true
DEMO_PASSWORD=passpath-demo
```

### 4. Setup Database & Seed Demo Data

```bash
cd apps/backend

# Install dependencies
npm install

# Run Prisma migrations
npx prisma migrate dev

# Seed demo data (3 accounts + realistic data)
npm run db:seed-demo
```

You should see:
```
Demo accounts ready (password = $DEMO_PASSWORD, default "passpath-demo"):
  student@demo.passpath.app  (id u-...)
  parent@demo.passpath.app   (id u-...)
  admin@demo.passpath.app    (id u-...)
```

### 5. Start Backend

```bash
cd apps/backend
npm run start:dev
```

Backend should start on `http://localhost:3000`

### 6. Start Web App

```bash
cd apps/web

# Install dependencies (if not done)
npm install

# Start dev server
npm run dev
```

Web app should start on `http://localhost:8080`

### 7. Login with Demo Credentials

Visit `http://localhost:8080/login` and click one of the demo buttons:
- **Demo Student Account** → Instant access to student dashboard
- **Demo Parent Account** → Parent dashboard with linked child
- **Demo Admin Account** → Admin panel

That's it! No Firebase configuration needed for demo mode.

## Troubleshooting

### "Port 3000 already in use"

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### "Prisma could not connect to database"

1. Check PostgreSQL is running: `psql -U passpath -d passpath`
2. Verify credentials in `.env` match your PostgreSQL setup
3. Try: `npx prisma migrate reset` (warning: deletes all data)

**Using Docker:**
```bash
docker-compose up -d db
# Wait 5 seconds for DB to initialize
npx prisma migrate dev
```

### "Redis connection failed"

1. Check Redis is running: `redis-cli ping` (should return "PONG")
2. Start Redis:
   - **Docker:** `docker-compose up -d redis`
   - **Windows:** Start Redis service
   - **macOS:** `brew services start redis`
   - **Linux:** `sudo systemctl start redis`

### "Firebase credentials not configured"

This is **expected in dev mode**. You can ignore this warning when using demo accounts.

For production Firebase auth, see the [main README](README.md).

### "OPENAI_API_KEY not set"

This is **expected in dev mode**. AI features will be unavailable but won't block login/dashboard.

To enable AI features, add to backend `.env`:
```env
OPENAI_API_KEY=sk-...
```

### Demo login fails with "Dev auth is disabled"

1. Check backend `.env` has `ENABLE_DEV_AUTH=true`
2. Restart backend: Stop (Ctrl+C) and run `npm run start:dev` again
3. Confirm demo accounts exist: `npm run db:seed-demo`

### Cannot access backend from mobile app

For Expo Go on a physical device:

1. Find your machine's LAN IP:
   - **Windows:** `ipconfig` → Look for IPv4 Address
   - **macOS/Linux:** `ifconfig` → Look for inet address

2. Update `apps/mobile/app.json`:
   ```json
   "apiBaseUrl": "http://192.168.x.x:3000/api"
   ```

3. Ensure your phone and computer are on the same WiFi network

4. Check firewall allows port 3000

## Next Steps

- 📖 Read [DEMO.md](DEMO.md) for complete demo feature documentation
- 🔥 Set up Firebase for production auth
- 🤖 Add OpenAI API key for AI features
- 🚀 Deploy to production (see deployment docs)

## Quick Commands Reference

```bash
# Backend
cd apps/backend
npm run start:dev          # Start backend dev server
npm run db:seed-demo       # Seed demo data
npx prisma studio         # Open database GUI
npm test                  # Run tests

# Web
cd apps/web
npm run dev               # Start Next.js dev server
npm run build             # Production build

# Mobile
cd apps/mobile
npx expo start            # Start Expo Metro bundler
npx expo start -c         # Clear cache and start
npm run typecheck         # Check TypeScript errors
```

## Environment Summary

| Service    | Port | Required | Purpose                    |
|------------|------|----------|----------------------------|
| Backend    | 3000 | ✅ Yes   | NestJS API server          |
| PostgreSQL | 5432 | ✅ Yes   | Database                   |
| Redis      | 6379 | ✅ Yes   | Caching & rate limiting    |
| Web        | 8080 | ⚠️ Dev   | Next.js frontend           |
| Firebase   | -    | ⚠️ Prod  | Identity provider          |
| OpenAI     | -    | ⚠️ Opt   | AI features                |

Happy coding! 🎉
