# PassPath Development Startup Script
# Run this from the project root: .\scripts\start-dev.ps1

Write-Host "🚀 Starting PassPath Development Environment" -ForegroundColor Cyan
Write-Host ""

# Check if port 3000 is in use
$port3000 = netstat -ano | findstr ":3000.*LISTENING"
if ($port3000) {
    Write-Host "⚠️  Port 3000 is already in use!" -ForegroundColor Yellow
    $pid = ($port3000 -split '\s+')[-1]
    Write-Host "   Process ID: $pid" -ForegroundColor Yellow
    $choice = Read-Host "Kill this process? (y/n)"
    if ($choice -eq 'y') {
        taskkill /PID $pid /F
        Write-Host "✅ Process stopped" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "❌ Cannot start backend on port 3000" -ForegroundColor Red
        exit 1
    }
}

# Check PostgreSQL
Write-Host "🔍 Checking PostgreSQL..." -ForegroundColor Cyan
$pgTest = Test-Connection -ComputerName localhost -Port 5432 -ErrorAction SilentlyContinue
if (-not $pgTest) {
    Write-Host "⚠️  PostgreSQL not detected on localhost:5432" -ForegroundColor Yellow
    Write-Host "   Start it with: docker-compose up -d db" -ForegroundColor Yellow
    Write-Host "   Or start your local PostgreSQL service" -ForegroundColor Yellow
    $choice = Read-Host "Continue anyway? (y/n)"
    if ($choice -ne 'y') { exit 1 }
} else {
    Write-Host "✅ PostgreSQL is running" -ForegroundColor Green
}

# Check Redis
Write-Host "🔍 Checking Redis..." -ForegroundColor Cyan
$redisTest = Test-Connection -ComputerName localhost -Port 6379 -ErrorAction SilentlyContinue
if (-not $redisTest) {
    Write-Host "⚠️  Redis not detected on localhost:6379" -ForegroundColor Yellow
    Write-Host "   Start it with: docker-compose up -d redis" -ForegroundColor Yellow
    Write-Host "   Or start your local Redis service" -ForegroundColor Yellow
    $choice = Read-Host "Continue anyway? (y/n)"
    if ($choice -ne 'y') { exit 1 }
} else {
    Write-Host "✅ Redis is running" -ForegroundColor Green
}

# Check backend .env
Write-Host "🔍 Checking backend configuration..." -ForegroundColor Cyan
if (-not (Test-Path "apps\backend\.env")) {
    Write-Host "⚠️  Backend .env not found" -ForegroundColor Yellow
    Write-Host "   Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item "apps\backend\.env.example" "apps\backend\.env" -ErrorAction SilentlyContinue
    if (Test-Path "apps\backend\.env") {
        Write-Host "✅ Created apps\backend\.env" -ForegroundColor Green
        Write-Host "⚠️  Please edit apps\backend\.env with your configuration" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Backend .env exists" -ForegroundColor Green
}

# Check if demo data seeded
Write-Host ""
Write-Host "📊 Database Setup" -ForegroundColor Cyan
Write-Host "   Run these commands in apps\backend if needed:" -ForegroundColor Gray
Write-Host "   1. npx prisma migrate dev      (setup database)" -ForegroundColor Gray
Write-Host "   2. npm run db:seed-demo        (create demo accounts)" -ForegroundColor Gray
Write-Host ""

# Ask what to start
Write-Host "What would you like to start?" -ForegroundColor Cyan
Write-Host "1. Backend only (API server)" -ForegroundColor White
Write-Host "2. Web only (Frontend)" -ForegroundColor White
Write-Host "3. Both backend and web" -ForegroundColor White
Write-Host "4. Exit" -ForegroundColor White
$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🚀 Starting backend..." -ForegroundColor Cyan
        Set-Location apps\backend
        npm run start:dev
    }
    "2" {
        Write-Host ""
        Write-Host "🚀 Starting web..." -ForegroundColor Cyan
        Set-Location apps\web
        npm run dev
    }
    "3" {
        Write-Host ""
        Write-Host "🚀 Starting both backend and web..." -ForegroundColor Cyan
        Write-Host "   Backend: http://localhost:3000" -ForegroundColor Gray
        Write-Host "   Web: http://localhost:8080" -ForegroundColor Gray
        Write-Host ""
        Write-Host "⚠️  You'll need to run these in separate terminals:" -ForegroundColor Yellow
        Write-Host "   Terminal 1: cd apps\backend && npm run start:dev" -ForegroundColor White
        Write-Host "   Terminal 2: cd apps\web && npm run dev" -ForegroundColor White
    }
    "4" {
        Write-Host "👋 Goodbye!" -ForegroundColor Cyan
        exit 0
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}
