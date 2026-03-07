param()

$testFile = Join-Path $PSScriptRoot "layout_publish.test.sql"
if (-not (Test-Path $testFile)) {
  throw "SQL verification file is missing: $testFile"
}

$containerName = "supabase_db_wos-local"
$running = docker ps --format "{{.Names}}" | Select-String -SimpleMatch $containerName
if (-not $running) {
  throw "Local Supabase DB container is not running: $containerName"
}

Get-Content -Raw -Path $testFile |
  docker exec -i $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres

if ($LASTEXITCODE -ne 0) {
  throw "SQL lifecycle verification failed."
}

Write-Host "SQL lifecycle verification passed against local DB container: $containerName"
