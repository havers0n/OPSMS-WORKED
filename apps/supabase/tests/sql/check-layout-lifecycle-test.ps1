param()

$testFiles = Get-ChildItem -Path $PSScriptRoot -Filter "*.test.sql" | Sort-Object Name
if ($testFiles.Count -eq 0) {
  throw "No SQL verification files were found under: $PSScriptRoot"
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

foreach ($testFile in $testFiles) {
  Get-Content -Raw -Path $testFile.FullName |
    docker exec -i $containerName psql -h 127.0.0.1 -v ON_ERROR_STOP=1 -U supabase_admin -d postgres

  if ($LASTEXITCODE -ne 0) {
    throw "SQL verification failed for file: $($testFile.Name)"
  }
}

Write-Host "SQL verification passed against local DB container: $containerName"
