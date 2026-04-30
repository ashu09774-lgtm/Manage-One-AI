param(
  [Parameter(Mandatory = $true)]
  [string]$SqlPath,
  [string]$StorageZipPath,
  [string]$MysqlPath = "C:\xampp\mysql\bin\mysql.exe",
  [string]$HostName = $env:DB_HOST,
  [string]$Port = $env:DB_PORT,
  [string]$User = $env:DB_USER,
  [string]$Password = $env:DB_PASSWORD
)

if (-not (Test-Path $MysqlPath)) {
  Write-Error "MySQL client not found at $MysqlPath"
  exit 1
}

if (-not (Test-Path $SqlPath)) {
  Write-Error "SQL backup not found at $SqlPath"
  exit 1
}

$mysqlArgs = @(
  "-h", $(if ([string]::IsNullOrWhiteSpace($HostName)) { "127.0.0.1" } else { $HostName }),
  "-P", $(if ([string]::IsNullOrWhiteSpace($Port)) { "3306" } else { $Port }),
  "-u", $(if ([string]::IsNullOrWhiteSpace($User)) { "root" } else { $User })
)

if (-not [string]::IsNullOrWhiteSpace($Password)) {
  $mysqlArgs += "-p$Password"
}

Get-Content $SqlPath | & $MysqlPath @mysqlArgs

if ($LASTEXITCODE -ne 0) {
  Write-Error "Database restore failed."
  exit $LASTEXITCODE
}

if (-not [string]::IsNullOrWhiteSpace($StorageZipPath)) {
  if (-not (Test-Path $StorageZipPath)) {
    Write-Error "Storage backup not found at $StorageZipPath"
    exit 1
  }

  $uploadsPath = Join-Path (Split-Path $PSScriptRoot -Parent) "public\uploads"
  New-Item -ItemType Directory -Force -Path $uploadsPath | Out-Null
  Expand-Archive -Path $StorageZipPath -DestinationPath $uploadsPath -Force
}

Write-Host "Restore completed."
