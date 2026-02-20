# Quick Start Script for EvaraTech Platform (Windows PowerShell)
# This script helps you get the platform running quickly on Windows

Write-Host "🚀 EvaraTech Platform Quick Start" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ $pythonVersion found" -ForegroundColor Green
} catch {
    Write-Host "❌ Python is not installed. Please install Python 3.10 or higher." -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18 or higher." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Setup Backend
Write-Host "📦 Setting up backend..." -ForegroundColor Yellow
Set-Location -Path "server"

if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv venv
}

# Activate virtual environment
& ".\venv\Scripts\Activate.ps1"
pip install -r requirements.txt

if (-not (Test-Path ".env")) {
    Write-Host "⚠️  No .env file found in server/" -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "📝 Copied .env.example to .env" -ForegroundColor Green
        Write-Host "📝 Please edit server/.env with your Supabase credentials!" -ForegroundColor Yellow
    } else {
        Write-Host "❌ No .env.example found. Please create .env manually." -ForegroundColor Red
    }
}

Set-Location -Path ".."

# Setup Frontend
Write-Host ""
Write-Host "📦 Setting up frontend..." -ForegroundColor Yellow
Set-Location -Path "client"

npm install

if (-not (Test-Path ".env")) {
    Write-Host "⚠️  No .env file found in client/" -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "📝 Copied .env.example to .env" -ForegroundColor Green
        Write-Host "📝 Please edit client/.env with your configuration!" -ForegroundColor Yellow
    } else {
        Write-Host "❌ No .env.example found. Please create .env manually." -ForegroundColor Red
    }
}

Set-Location -Path ".."

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit server\.env with your Supabase credentials"
Write-Host "2. Edit client\.env with your API URL"
Write-Host "3. Run the health check:"
Write-Host "   cd server"
Write-Host "   python health_check.py"
Write-Host ""
Write-Host "4. Start backend (in one terminal):"
Write-Host "   cd server"
Write-Host "   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
Write-Host ""
Write-Host "5. Start frontend (in another terminal):"
Write-Host "   cd client"
Write-Host "   npm run dev"
Write-Host ""
Write-Host "🌐 Access the app at http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Tip: Run 'python quick_start.ps1' to start both servers automatically" -ForegroundColor Cyan
