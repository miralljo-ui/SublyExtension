Param(
  [string]$OutZip = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  Write-Host "Building extension (npm run build:ext)…"
  npm run build:ext

  $pkg = Get-Content .\package.json | ConvertFrom-Json
  $version = $pkg.version

  if (-not $OutZip -or $OutZip.Trim().Length -eq 0) {
    $OutZip = Join-Path $repoRoot ("subly-extension-$version.zip")
  }

  if (Test-Path $OutZip) {
    Remove-Item $OutZip -Force
  }

  Write-Host "Creating ZIP: $OutZip"
  Compress-Archive -Path .\dist-ext\* -DestinationPath $OutZip -Force

  Write-Host "Done. Upload this ZIP to Chrome Web Store: $OutZip"
} finally {
  Pop-Location
}
