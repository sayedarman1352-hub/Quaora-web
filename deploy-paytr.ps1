$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$NodeDir = Get-ChildItem -Path (Join-Path $Root "tools") -Directory -Filter "node-*-win-x64" |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $NodeDir) {
  Write-Host "Portable Node bulunamadi. Node.js LTS kur veya Codex'te Node indirme adimini tekrar calistir." -ForegroundColor Red
  exit 1
}

$env:Path = "$($NodeDir.FullName);$env:Path"
$Npm = Join-Path $NodeDir.FullName "npm.cmd"
$Node = Join-Path $NodeDir.FullName "node.exe"

Write-Host "Node:" (& $Node -v)
Write-Host "npm:" (& $Npm -v)

Write-Host "Functions paketleri kuruluyor..."
& $Npm --prefix functions install

Write-Host "Firebase CLI proje icine kuruluyor..."
New-Item -ItemType Directory -Force -Path (Join-Path $Root "tools/firebase-cli") | Out-Null
& $Npm --prefix tools/firebase-cli install firebase-tools

$Firebase = Join-Path $Root "tools/firebase-cli/node_modules/firebase-tools/lib/bin/firebase.js"

Write-Host "Firebase login kontrolu..."
& $Node $Firebase projects:list
if ($LASTEXITCODE -ne 0) {
  Write-Host "Firebase login gerekiyor. Acilan linkten Google hesabinla giris yap." -ForegroundColor Yellow
  & $Node $Firebase login
}

Write-Host "PayTR backend + hosting + Firestore rules deploy ediliyor..."
& $Node $Firebase deploy --only functions,hosting,firestore:rules --project quaora-web

Write-Host "Bitti. PayTR Bildirim URL: https://quaora.com.tr/api/paytr-callback" -ForegroundColor Green
