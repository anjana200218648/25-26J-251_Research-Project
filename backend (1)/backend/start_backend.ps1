# Start Backend with FFmpeg
# This script ensures FFmpeg is available before starting the Flask backend

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "         SafeKid Backend Startup Script" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Find FFmpeg
Write-Host "`n[1/3] Checking FFmpeg installation..." -ForegroundColor Yellow
$ffmpegPath = Get-ChildItem "$env:USERPROFILE\ffmpeg" -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($ffmpegPath) {
    $ffmpegBin = $ffmpegPath.Directory.FullName
    Write-Host "      [OK] Found FFmpeg at: $ffmpegBin" -ForegroundColor Green
    
    # Add to PATH for this session
    $env:PATH = "$ffmpegBin;$env:PATH"
    
    # Verify FFmpeg is accessible
    try {
        $version = (ffmpeg -version 2>&1 | Select-Object -First 1)
        Write-Host "      [OK] FFmpeg is working" -ForegroundColor Green
    } catch {
        Write-Host "      [ERROR] FFmpeg found but not executable" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "      [WARN] FFmpeg not found in user directory" -ForegroundColor Yellow
    
    # Check if already in system PATH
    try {
        $version = (ffmpeg -version 2>&1 | Select-Object -First 1)
        Write-Host "      [OK] FFmpeg found in system PATH" -ForegroundColor Green
    } catch {
        Write-Host "      [ERROR] FFmpeg not found!" -ForegroundColor Red
        Write-Host "`n      Install FFmpeg:" -ForegroundColor Yellow
        Write-Host "        Windows: winget install --id Gyan.FFmpeg" -ForegroundColor White
        Write-Host "        Or download from: https://ffmpeg.org/download.html" -ForegroundColor White
        Write-Host "`n      Voice transcription will fail without FFmpeg!`n" -ForegroundColor Red
        
        $response = Read-Host "      Continue anyway? (y/N)"
        if ($response -ne 'y' -and $response -ne 'Y') {
            exit 1
        }
    }
}

# Check Python virtual environment
Write-Host "`n[2/3] Checking Python environment..." -ForegroundColor Yellow
if (Test-Path "..\.venv\Scripts\Activate.ps1") {
    Write-Host "      [OK] Virtual environment found" -ForegroundColor Green
} else {
    Write-Host "      [WARN] Virtual environment not found at ..\.venv" -ForegroundColor Yellow
}

# Check required directories
Write-Host "`n[3/3] Checking required directories..." -ForegroundColor Yellow
$dirs = @("trained_model", "pretrained_models", "temp_voice_uploads")
foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        Write-Host "      [OK] $dir exists" -ForegroundColor Green
    } else {
        Write-Host "      [INFO] $dir will be created automatically" -ForegroundColor Cyan
    }
}

# Start Flask backend
Write-Host "`n==================================================`n" -ForegroundColor Cyan
Write-Host "Starting Flask backend server..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server`n" -ForegroundColor Yellow

python app.py
