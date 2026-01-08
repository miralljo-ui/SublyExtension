Param(
  [Parameter(Mandatory=$true)]
  [string]$InputPath,
  [string]$OutputDir = "public"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-AbsolutePath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-Location) $Path)
}

$inputAbs = Resolve-AbsolutePath $InputPath
$outputAbs = Resolve-AbsolutePath $OutputDir

if (-not (Test-Path $inputAbs)) {
  throw "Input logo not found: $inputAbs"
}

New-Item -ItemType Directory -Force -Path $outputAbs | Out-Null

Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)

$src = [System.Drawing.Image]::FromFile($inputAbs)
try {
  foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    try {
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($src, 0, 0, $size, $size)
      } finally {
        $g.Dispose()
      }
      $outPath = Join-Path $outputAbs "icon-$size.png"
      $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Host "Wrote $outPath"
    } finally {
      $bmp.Dispose()
    }
  }
} finally {
  $src.Dispose()
}
