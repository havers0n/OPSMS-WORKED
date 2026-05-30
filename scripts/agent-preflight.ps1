$ErrorActionPreference = "Stop"

function Test-Tool {
  param([string]$Name)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $cmd) {
    return "missing"
  }
  return "available"
}

Write-Output "== Agent Preflight =="
Write-Output ""
Write-Output "-- Git status (short) --"
git status --short
Write-Output ""

$tools = @("node", "npm", "rg", "gh", "supabase", "docker")
Write-Output "-- Tool availability --"
foreach ($tool in $tools) {
  $status = Test-Tool -Name $tool
  Write-Output ("{0}: {1}" -f $tool, $status)
}
Write-Output ""

if ((Test-Tool -Name "docker") -eq "available") {
  Write-Output "-- Docker containers --"
  docker ps --format "table {{.Names}}\t{{.Status}}"
  Write-Output ""
}

Write-Output "Preflight complete."
