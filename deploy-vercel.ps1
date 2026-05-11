$ErrorActionPreference = "Stop"

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

Write-Host "Vercel production deploy basliyor..."
& $Npm exec vercel -- --prod

Write-Host "Bitti. PayTR Bildirim URL: https://quaora.com.tr/api/paytr-callback" -ForegroundColor Green
