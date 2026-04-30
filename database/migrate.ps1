param(
  [string]$DatabaseName = $env:DB_NAME,
  [string]$MysqlPath = "C:\xampp\mysql\bin\mysql.exe",
  [string]$HostName = $env:DB_HOST,
  [string]$Port = $env:DB_PORT,
  [string]$User = $env:DB_USER,
  [string]$Password = $env:DB_PASSWORD,
  [switch]$Seed,
  [switch]$Reset,
  [switch]$Test
)

if ($Test) {
  $DatabaseName = $env:DB_TEST_NAME

  if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
    $DatabaseName = "taskflow_auth_test"
  }
}

if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
  $DatabaseName = "taskflow_auth"
}

if (-not (Test-Path $MysqlPath)) {
  Write-Error "MySQL client not found at $MysqlPath"
  exit 1
}

$mysqlArgs = @()
$mysqlArgs += "-h"
$mysqlArgs += $(if ([string]::IsNullOrWhiteSpace($HostName)) { "127.0.0.1" } else { $HostName })
$mysqlArgs += "-P"
$mysqlArgs += $(if ([string]::IsNullOrWhiteSpace($Port)) { "3306" } else { $Port })
$mysqlArgs += "-u"
$mysqlArgs += $(if ([string]::IsNullOrWhiteSpace($User)) { "root" } else { $User })

if (-not [string]::IsNullOrWhiteSpace($Password)) {
  $mysqlArgs += "-p$Password"
}

if ($Reset) {
  "DROP DATABASE IF EXISTS ``$DatabaseName``;" | & $MysqlPath @mysqlArgs
}

$schema = Get-Content "$PSScriptRoot\schema.sql" -Raw
$schema = $schema -replace "taskflow_auth", $DatabaseName
$schema | & $MysqlPath @mysqlArgs

if ($LASTEXITCODE -ne 0) {
  Write-Error "Schema migration failed for database '$DatabaseName'."
  exit $LASTEXITCODE
}

if ($Seed) {
  Get-Content "$PSScriptRoot\seed.sql" | & $MysqlPath @mysqlArgs $DatabaseName

  if ($LASTEXITCODE -ne 0) {
    Write-Error "Seed data failed for database '$DatabaseName'."
    exit $LASTEXITCODE
  }
}

Write-Host "Database '$DatabaseName' is ready."
