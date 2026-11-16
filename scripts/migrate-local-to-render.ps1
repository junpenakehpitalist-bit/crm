<#
  Copies the DATA of your LOCAL PostgreSQL database (DATABASE_URL in .env) into the
  PostgreSQL database on Render.

  What it does
    1. Applies Prisma migrations on Render (so the tables exist).
    2. EMPTIES every app table on Render (Contact, Company, Deal, User, ...).   (destructive)
    3. Dumps the local data (data only) and loads it into Render in ONE transaction,
       together with step 2. If the load fails, everything rolls back and the existing
       Render data stays untouched.

  After the copy, Render has exactly your local data, including your LOCAL admin login
  (admin@local.test with the local ADMIN_PASSWORD). Render's own admin user is replaced.

  Usage (PowerShell, from the project folder):
    .\scripts\migrate-local-to-render.ps1
    .\scripts\migrate-local-to-render.ps1 -RenderUrl "postgresql://USER:PASS@HOST.singapore-postgres.render.com/DB"

  Use Render's EXTERNAL Database URL (host ends in .render.com) and allow your IP under
  database > Networking > Inbound rules. The URL is read from -RenderUrl, then
  $env:RENDER_DATABASE_URL, then a hidden prompt. Nothing is saved to disk except the
  temporary dump file, which is deleted at the end.
#>
param(
  [string]$RenderUrl = $env:RENDER_DATABASE_URL,
  [string]$PgBin = 'D:\Program Files\PostgreSQL\18\bin'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$psql = Join-Path $PgBin 'psql.exe'
$pgDump = Join-Path $PgBin 'pg_dump.exe'
foreach ($exe in @($psql, $pgDump)) { if (-not (Test-Path $exe)) { throw "Not found: $exe  (use -PgBin to point at PostgreSQL's bin folder)" } }

# ---- local database (from .env) ----
$envLine = Select-String -Path (Join-Path $root '.env') -Pattern '^\s*DATABASE_URL="?([^"]+)"?' | Select-Object -First 1
if (-not $envLine) { throw 'DATABASE_URL not found in .env' }
$local = [Uri]($envLine.Matches[0].Groups[1].Value -replace '\?.*$', '')
if ($local.Host -notin @('localhost', '127.0.0.1', '::1')) { throw "DATABASE_URL in .env is not local ($($local.Host)). Refusing to use it as the source." }
$localUser, $localPass = ($local.UserInfo -split ':', 2) | ForEach-Object { [Uri]::UnescapeDataString($_) }
$localDb = $local.AbsolutePath.TrimStart('/')
$localPort = if ($local.Port -gt 0) { $local.Port } else { 5432 }

# ---- Render database ----
if (-not $RenderUrl) {
  $secure = Read-Host 'Paste the Render EXTERNAL Database URL' -AsSecureString
  $RenderUrl = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
$RenderUrl = $RenderUrl.Trim().Trim('"')
if ($RenderUrl -notmatch '^postgres(ql)?://') { throw 'RenderUrl must start with postgresql://' }
if ($RenderUrl -notmatch '@[^/]+\.[^/]+') { throw 'That looks like the INTERNAL URL (host has no ".render.com"). Use the EXTERNAL Database URL.' }
if ($RenderUrl -notmatch 'sslmode=') { $RenderUrl += $(if ($RenderUrl.Contains('?')) { '&' } else { '?' }) + 'sslmode=require' }
$renderHost = ([Uri]($RenderUrl -replace '^postgres(ql)?://', 'http://')).Host

Write-Host "`nSource : local   $localUser@localhost:$localPort/$localDb"
Write-Host "Target : Render  $renderHost"
Write-Host 'All existing data on Render will be ERASED and replaced with your local data.' -ForegroundColor Yellow
$answer = Read-Host "Type YES to continue"
if ($answer -ne 'YES') { Write-Host 'Cancelled.'; return }

$tables = '"Account","Session","VerificationToken","Contact","Company","PipelineStage","Deal","Activity","Transaction","GoogleOAuthToken","User"'
$dump = Join-Path $env:TEMP ("crm-local-dump-{0}.sql" -f (Get-Date -Format yyyyMMddHHmmss))

try {
  # 1. schema on Render
  Write-Host "`n[1/4] Applying migrations on Render..." -ForegroundColor Cyan
  $env:DATABASE_URL = $RenderUrl
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy failed.' }

  # 2. dump local data
  Write-Host "`n[2/4] Dumping local data..." -ForegroundColor Cyan
  $env:PGPASSWORD = $localPass
  & $pgDump -h localhost -p $localPort -U $localUser -d $localDb --data-only --no-owner --no-privileges --exclude-table='_prisma_migrations' -f $dump
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
  # Older Render servers do not know this setting (pg_dump 17+ emits it).
  (Get-Content $dump) | Where-Object { $_ -notmatch '^SET transaction_timeout' } | Set-Content $dump -Encoding utf8

  # 3. empty Render tables + load, in ONE transaction (all-or-nothing)
  Write-Host "`n[3/4] Replacing Render data..." -ForegroundColor Cyan
  $wrapped = $dump + '.load.sql'
  @('BEGIN;', "TRUNCATE TABLE $tables CASCADE;") | Set-Content $wrapped -Encoding utf8
  Get-Content $dump | Add-Content $wrapped -Encoding utf8
  'COMMIT;' | Add-Content $wrapped -Encoding utf8
  Remove-Item Env:PGPASSWORD
  & $psql $RenderUrl -v ON_ERROR_STOP=1 -f $wrapped
  if ($LASTEXITCODE -ne 0) { throw 'Load failed. The transaction was rolled back, Render data is unchanged.' }

  # 4. verify
  Write-Host "`n[4/4] Row counts on Render:" -ForegroundColor Cyan
  & $psql $RenderUrl -c 'SELECT (SELECT count(*) FROM "User") users, (SELECT count(*) FROM "Company") companies, (SELECT count(*) FROM "Contact") contacts, (SELECT count(*) FROM "Deal") deals, (SELECT count(*) FROM "PipelineStage") stages;'
  Write-Host "`nDone." -ForegroundColor Green
}
finally {
  Remove-Item $dump, "$dump.load.sql" -ErrorAction SilentlyContinue
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
