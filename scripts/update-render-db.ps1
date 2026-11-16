<#
  Updates the PostgreSQL database hosted on Render from your PC.

    1. Applies pending Prisma migrations   (prisma migrate deploy)
    2. Upserts pipeline stages + admin user (scripts/seed-production.ts)
    3. Optionally adds dummy companies/contacts (scripts/seed-dummy.ts)  -> use -Dummy

  Usage (from the project folder, in PowerShell):
    .\scripts\update-render-db.ps1
    .\scripts\update-render-db.ps1 -Dummy
    .\scripts\update-render-db.ps1 -DatabaseUrl "postgresql://USER:PASS@HOST.singapore-postgres.render.com/DB"

  Use Render's EXTERNAL Database URL (the internal one only works inside Render).
  Render must allow your IP: database > Networking > Inbound rules.
  The URL is read from -DatabaseUrl, then $env:RENDER_DATABASE_URL, then a hidden prompt.
  Nothing is written to disk.
#>
param(
  [string]$DatabaseUrl = $env:RENDER_DATABASE_URL,
  [switch]$Dummy
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not $DatabaseUrl) {
  $secure = Read-Host 'Paste the Render EXTERNAL Database URL' -AsSecureString
  $DatabaseUrl = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
$DatabaseUrl = $DatabaseUrl.Trim().Trim('"')
if ($DatabaseUrl -notmatch '^postgres(ql)?://') { throw 'DatabaseUrl must start with postgresql://' }
if ($DatabaseUrl -match '\.internal|^postgres(ql)?://[^@]+@dpg-[a-z0-9]+-a(/|$)') {
  throw 'That looks like the INTERNAL URL (no ".render.com" host). Use the EXTERNAL Database URL.'
}
if ($DatabaseUrl -notmatch 'sslmode=') {
  $DatabaseUrl += $(if ($DatabaseUrl.Contains('?')) { '&' } else { '?' }) + 'sslmode=require'
}
$env:DATABASE_URL = $DatabaseUrl

# Admin account created/left alone by the seed (only if ADMIN_* are set).
if (-not $env:ADMIN_EMAIL -or -not $env:ADMIN_PASSWORD) {
  Write-Host 'ADMIN_EMAIL / ADMIN_PASSWORD not set in this shell: admin user creation will be skipped.' -ForegroundColor Yellow
}

Write-Host "`n[1/3] Applying migrations..." -ForegroundColor Cyan
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy failed.' }

Write-Host "`n[2/3] Seeding stages + admin..." -ForegroundColor Cyan
npx tsx scripts/seed-production.ts
if ($LASTEXITCODE -ne 0) { throw 'seed-production failed.' }

if ($Dummy) {
  Write-Host "`n[3/3] Adding dummy contacts..." -ForegroundColor Cyan
  npx tsx scripts/seed-dummy.ts
  if ($LASTEXITCODE -ne 0) { throw 'seed-dummy failed.' }
} else {
  Write-Host "`n[3/3] Skipped dummy data (add -Dummy to include it)." -ForegroundColor DarkGray
}

Write-Host "`nDone." -ForegroundColor Green
