$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$NodeDir = Get-ChildItem -Path (Join-Path $Root "tools") -Directory -Filter "node-*-win-x64" -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  Select-Object -First 1

if ($NodeDir) {
  $env:Path = "$($NodeDir.FullName);$env:Path"
}

$Npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $Npm -and $NodeDir) {
  $Npm = Join-Path $NodeDir.FullName "npm.cmd"
}

if (-not $Npm) {
  Write-Host "npm bulunamadi. Node.js LTS kur veya tools/node-*-win-x64 klasorunu hazirla." -ForegroundColor Red
  exit 1
}

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
