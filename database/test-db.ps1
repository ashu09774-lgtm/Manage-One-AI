param(
  [string]$DatabaseName = $env:DB_TEST_NAME
)

if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
  $DatabaseName = "taskflow_auth_test"
}

& "$PSScriptRoot\migrate.ps1" -DatabaseName $DatabaseName -Reset -Seed

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Test database '$DatabaseName' was rebuilt with seed data."
