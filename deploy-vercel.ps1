$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

# Vercel CLI can mistake an old project-local OIDC token for a deploy token.
# Keep the file, but hide it while the CLI performs auth/deploy.
$EnvLocal = Join-Path $Root ".env.local"
$EnvLocalBackup = Join-Path $Root ".env.local.vercel-deploy-backup"
$MovedEnvLocal = $false
Remove-Item Env:VERCEL_OIDC_TOKEN -ErrorAction SilentlyContinue
if ((Test-Path $EnvLocal) -and (Select-String -Path $EnvLocal -Pattern "VERCEL_OIDC_TOKEN" -Quiet)) {
  Move-Item -LiteralPath $EnvLocal -Destination $EnvLocalBackup -Force
  $MovedEnvLocal = $true
}

$NodeDir = Get-ChildItem -Path (Join-Path $Root "tools") -Directory -Filter "node-*-win-x64" -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  Select-Object -First 1

if ($NodeDir) {
  $env:Path = "$($NodeDir.FullName);$env:Path"
}

$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $Npm) {
  $Npm = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $Npm -and $NodeDir) {
  $Npm = Join-Path $NodeDir.FullName "npm.cmd"
}

if (-not $Npm) {
  Write-Host "npm bulunamadi. Node.js LTS kur veya tools/node-*-win-x64 klasorunu hazirla." -ForegroundColor Red
  exit 1
}

try {
  Write-Host "Paketler kuruluyor..."
  & $Npm install
  if ($LASTEXITCODE -ne 0) {
    throw "npm install basarisiz oldu."
  }

  Write-Host "Vercel production deploy basliyor..."
  if ($env:VERCEL_TOKEN) {
    & $Npm exec vercel -- --prod --token $env:VERCEL_TOKEN
  } else {
    & $Npm exec vercel -- --prod
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Vercel production deploy basarisiz oldu. Vercel CLI icin 'vercel login' yap veya VERCEL_TOKEN ortam degiskenini ayarla."
  }

  Write-Host "Bitti. PayTR Bildirim URL: https://quaora.com.tr/api/paytr-callback" -ForegroundColor Green
} finally {
  if ($MovedEnvLocal -and (Test-Path $EnvLocalBackup)) {
    Move-Item -LiteralPath $EnvLocalBackup -Destination $EnvLocal -Force
  }
}
