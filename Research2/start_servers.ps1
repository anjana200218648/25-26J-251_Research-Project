# PowerShell script to start both backend and frontend servers

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "🚀 AI Risk Assessment System" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check if Python is available
Write-Host "Checking Python..." -ForegroundColor Yellow
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "❌ Python not found. Please install Python 3.8+`n" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Python found: $($pythonCmd.Version)`n" -ForegroundColor Green

# Check if Node is available
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "❌ Node.js not found. Please install Node.js 16+`n" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js found: $(node --version)`n" -ForegroundColor Green

# Check if dependencies are installed
Write-Host "Checking dependencies..." -ForegroundColor Yellow

# Check Python packages
$flaskInstalled = python -c "import flask" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Flask not found. Installing backend dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt
    pip install -r backend/requirements.txt
}

# Check Node modules
if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "⚠️  Node modules not found. Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
}

Write-Host "✅ All dependencies ready`n" -ForegroundColor Green

# Start backend in new window
Write-Host "Starting Backend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '================================' -ForegroundColor Magenta
Write-Host '🔧 BACKEND SERVER (Flask)' -ForegroundColor Magenta
Write-Host '================================' -ForegroundColor Magenta
Write-Host 'Running on: http://localhost:5003' -ForegroundColor Green
Write-Host '================================`n' -ForegroundColor Magenta
python backend/app.py
"@

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start frontend in new window
Write-Host "Starting Frontend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Set-Location frontend
Write-Host '================================' -ForegroundColor Blue
Write-Host '⚛️  FRONTEND SERVER (React)' -ForegroundColor Blue
Write-Host '================================' -ForegroundColor Blue
Write-Host 'Running on: http://localhost:3000' -ForegroundColor Green
Write-Host '================================`n' -ForegroundColor Blue
npm run dev
"@

Write-Host "`n================================" -ForegroundColor Green
Write-Host "✅ Both servers are starting!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host "`n📱 Backend:  http://localhost:5003" -ForegroundColor White
Write-Host "🌐 Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "`nPress Ctrl+C in each window to stop servers`n" -ForegroundColor Yellow

# Open browser after a delay
Start-Sleep -Seconds 5
Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"

