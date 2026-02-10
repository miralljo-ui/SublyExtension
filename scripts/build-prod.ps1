# Load .env.local variables and build extension
$envFile = Join-Path $PSScriptRoot '..' '.env.local'

if (Test-Path $envFile) {
    $content = Get-Content $envFile
    foreach ($line in $content) {
        if ($line -match '^([A-Z_]+)=(.+)$') {
            $var = $matches[1]
            $val = $matches[2]
            [Environment]::SetEnvironmentVariable($var, $val)
        }
    }
}

# Build for production
npm run build:ext:prod
npm run package:ext
