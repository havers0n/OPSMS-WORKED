param()

$testFile = Join-Path $PSScriptRoot "layout_publish.test.sql"
if (-not (Test-Path $testFile)) {
  throw "SQL verification file is missing: $testFile"
}

$supabaseProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$containerName = "supabase_db_wos-local"
$running = docker ps --format "{{.Names}}" | Select-String -SimpleMatch $containerName
if (-not $running) {
  throw "Local Supabase DB container is not running: $containerName"
}

Push-Location $supabaseProjectRoot
supabase db push --local --yes
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  throw "Failed to apply local Supabase migrations before SQL lifecycle verification."
}
Pop-Location

Get-Content -Raw -Path $testFile |
  docker exec -i $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres

if ($LASTEXITCODE -ne 0) {
  throw "SQL lifecycle verification failed."
}

Write-Host "SQL lifecycle verification passed against local DB container: $containerName"
