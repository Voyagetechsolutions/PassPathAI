# PassPath Setup Guide for Windows (Without Docker)

You have **three options** to run PassPath on Windows without Docker:

## Option 1: Install Docker Desktop (Recommended ⭐)

This is the easiest and most reliable approach.

### Steps:

1. **Download Docker Desktop for Windows:**
   - Visit: https://www.docker.com/products/docker-desktop/
   - Download and install Docker Desktop
   - Restart your computer after installation

2. **Start Docker Desktop** from the Start menu

3. **Run the project:**
   ```powershell
   cd C:\Users\Mthokozisi.DESKTOP-DPOBCC1\Documents\PassPath
   docker compose up -d db redis
   ```
   Note: Modern Docker uses `docker compose` (with space), not `docker-compose`

4. **Continue with setup:**
   ```bash
   cd apps\backend
   npm install
   npx prisma migrate dev
   npm run db:seed-demo
   npm run start:dev
   ```

---

## Option 2: Install PostgreSQL & Redis Locally

Install database services directly on Windows.

### 2A. Install PostgreSQL

1. **Download PostgreSQL:**
   - Visit: https://www.postgresql.org/download/windows/
   - Download the installer (version 14 or later recommended)
   - Run the installer

2. **During installation:**
   - Set password to: `passpath` (or update `DATABASE_URL` in `.env`)
   - Port: `5432` (default)
   - Remember the password!

3. **Create the database:**
   ```powershell
   # Open Command Prompt or PowerShell
   # Login to PostgreSQL (password: what you set during install)
   psql -U postgres
   
   # In the psql prompt:
   CREATE USER passpath WITH PASSWORD 'passpath';
   CREATE DATABASE passpath OWNER passpath;
   \q
   ```

4. **Update backend `.env`:**
   ```env
   DATABASE_URL=postgresql://passpath:passpath@localhost:5432/passpath?schema=public
   ```

### 2B. Install Redis

**Option 2B.1: Using Windows Subsystem for Linux (WSL)**

1. Install WSL:
   ```powershell
   wsl --install
   ```
   Restart your computer after installation.

2. Install Redis in WSL:
   ```bash
   # In WSL terminal
   sudo apt update
   sudo apt install redis-server
   sudo service redis-server start
   ```

3. Redis will be available at `localhost:6379`

**Option 2B.2: Using Memurai (Redis alternative for Windows)**

1. Download Memurai:
   - Visit: https://www.memurai.com/get-memurai
   - Download and install Memurai (free for development)

2. Start Memurai service:
   - It should auto-start after installation
   - Or run from Start menu

3. Redis will be available at `localhost:6379`

### 2C. Verify Installation

```powershell
# Test PostgreSQL connection
psql -U passpath -d passpath

# Test Redis connection (if Memurai installed)
memurai-cli ping
# Should return: PONG
```

---

## Option 3: Use Cloud Databases (Quick Test)

For quick testing without local installation:

### 3A. Free PostgreSQL (Supabase)

1. Visit: https://supabase.com (free tier)
2. Create a new project
3. Get the connection string from Settings → Database
4. Update `apps\backend\.env`:
   ```env
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT].supabase.co:5432/postgres
   ```

### 3B. Free Redis (Upstash)

1. Visit: https://upstash.com (free tier)
2. Create a Redis database
3. Get the connection details
4. Update `apps\backend\.env`:
   ```env
   REDIS_HOST=your-redis-url.upstash.io
   REDIS_PORT=6379
   REDIS_PASSWORD=your-redis-password
   REDIS_TLS=true
   ```

---

## After Installing Dependencies

Once PostgreSQL and Redis are running (via any option above):

### 1. Kill the process on port 3000:
```powershell
taskkill /PID 5524 /F
```

### 2. Setup the database:
```bash
cd apps\backend
npm install
npx prisma migrate dev
npm run db:seed-demo
```

### 3. Start the backend:
```bash
npm run start:dev
```

### 4. In a new terminal, start the web app:
```bash
cd apps\web
npm install
npm run dev
```

### 5. Open browser:
- Visit: http://localhost:8080/login
- Click any demo account button
- You're in! 🎉

---

## Troubleshooting

### "Port 3000 already in use"
```powershell
# Find the process
netstat -ano | findstr :3000

# Kill it (replace PID with the number from above)
taskkill /PID <PID> /F
```

### "Cannot connect to PostgreSQL"
- Check PostgreSQL service is running:
  - Open Services (Win + R → `services.msc`)
  - Look for "postgresql-x64-XX"
  - Ensure it's "Running"
- Verify credentials in `.env` match PostgreSQL setup

### "Cannot connect to Redis"
- Check Redis/Memurai service is running:
  - Open Services (Win + R → `services.msc`)
  - Look for "Memurai" or "Redis"
  - Ensure it's "Running"

### "Module not found" errors
```bash
# In the failing directory
rm -rf node_modules
npm install
```

---

## My Recommendation

**For beginners:** Install **Docker Desktop** (Option 1)
- Easiest to set up
- Most reliable
- Matches production environment
- One command to start everything

**For developers:** Install locally (Option 2)
- Better performance
- More control
- Learn database administration
- No Docker overhead

**For quick testing:** Use cloud (Option 3)
- No local installation
- Start coding immediately
- Good for demos
- May have latency

---

## Quick Reference Commands

```bash
# Check what's running on a port
netstat -ano | findstr :PORT

# Kill a process
taskkill /PID <PID> /F

# Test PostgreSQL
psql -U passpath -d passpath

# Test Redis (if Memurai)
memurai-cli ping

# Reset everything (careful - deletes data!)
cd apps\backend
npx prisma migrate reset
npm run db:seed-demo
```

---

## Need Help?

- PostgreSQL installation issues: https://www.postgresql.org/docs/current/tutorial-install.html
- Redis/Memurai issues: https://docs.memurai.com/
- Docker Desktop issues: https://docs.docker.com/desktop/troubleshoot/overview/
- PassPath issues: Check the main [QUICKSTART.md](QUICKSTART.md)
