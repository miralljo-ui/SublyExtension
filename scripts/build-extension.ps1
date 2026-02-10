# Build script that loads .env.local before building
# Usage: .\scripts\build-extension.ps1 -Mode prod

param(
    [ValidateSet('dev', 'prod')]
    [string]$Mode = 'prod',
    [switch]$Package
)

# Check if .env.local exists
$envLocalPath = Join-Path $PSScriptRoot '..' '.env.local'
if (-not (Test-Path $envLocalPath)) {
    Write-Error ".env.local not found at $envLocalPath"
    exit 1
}

# Load environment variables from .env.local
Write-Host "📁 Loading environment from .env.local..." -ForegroundColor Cyan
$envLines = Get-Content $envLocalPath | Where-Object { $_ -match '^VITE_' }

foreach ($line in $envLines) {
    if ($line -match '^([A-Z_]+)=(.+)$') {
        $key = $matches[1]
        $value = $matches[2]
        [Environment]::SetEnvironmentVariable($key, $value)
        Write-Host "  ✓ $key loaded" -ForegroundColor Green
    }
}

Write-Host ""

# Run the build
Write-Host "🔨 Building for $Mode..." -ForegroundColor Cyan
$npmScript = "build:ext:$Mode"
npm run $npmScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Build succeeded!" -ForegroundColor Green
    
    if ($Package) {
        Write-Host ""
        Write-Host "📦 Packaging extension..." -ForegroundColor Cyan
        npm run package:ext
    }
} else {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
