# Build script for RuChat Android APK
# Requires: JDK 17+, Android SDK

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  RuChat Android Build" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check Java
Write-Host "[1/4] Checking Java..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-String "version"
    Write-Host "  Java: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Java not found! Install JDK 17+" -ForegroundColor Red
    exit 1
}

# Create directories
Write-Host ""
Write-Host "[2/4] Creating directories..." -ForegroundColor Yellow
$dirs = @(
    "app\src\main\assets\www\js",
    "app\src\main\assets\www\css",
    "app\src\main\assets\www\assets\icons",
    "app\src\main\assets\www\assets\sounds"
)

foreach ($dir in $dirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

# Copy files
Write-Host ""
Write-Host "[3/4] Copying web files..." -ForegroundColor Yellow
$files = @(
    "..\index.html",
    "..\firebase.json",
    "..\database.rules.json"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Copy-Item $file "app\src\main\assets\www\" -Force
        Write-Host "  ✓ $file" -ForegroundColor Green
    }
}

# Copy directories
Copy-Item "..\js\*" "app\src\main\assets\www\js\" -Recurse -Force
Copy-Item "..\css\*" "app\src\main\assets\www\css\" -Recurse -Force
Copy-Item "..\assets\*" "app\src\main\assets\www\assets\" -Recurse -Force

Write-Host "  All files copied!" -ForegroundColor Green

# Build
Write-Host ""
Write-Host "[4/4] Building APK..." -ForegroundColor Yellow
Write-Host "  This may take several minutes..." -ForegroundColor Gray

try {
    & .\gradlew.bat assembleDebug
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESS!" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK location:" -ForegroundColor Cyan
    Write-Host "  app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White
    Write-Host ""
    Write-Host "To install on device:" -ForegroundColor Cyan
    Write-Host "  adb install app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White
} catch {
    Write-Host ""
    Write-Host "BUILD FAILED!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
