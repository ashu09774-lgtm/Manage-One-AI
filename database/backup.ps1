param(
  [string]$DatabaseName = $env:DB_NAME,
  [string]$MysqlDumpPath = "C:\xampp\mysql\bin\mysqldump.exe",
  [string]$HostName = $env:DB_HOST,
  [string]$Port = $env:DB_PORT,
  [string]$User = $env:DB_USER,
  [string]$Password = $env:DB_PASSWORD,
  [string]$BackupRoot = "$PSScriptRoot\backups"
)

if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
  $DatabaseName = "taskflow_auth"
}

if (-not (Test-Path $MysqlDumpPath)) {
  Write-Error "mysqldump not found at $MysqlDumpPath"
  exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dbBackupDir = Join-Path $BackupRoot "db"
$storageBackupDir = Join-Path $BackupRoot "storage"
New-Item -ItemType Directory -Force -Path $dbBackupDir, $storageBackupDir | Out-Null

$sqlPath = Join-Path $dbBackupDir "$DatabaseName-$timestamp.sql"
$dumpArgs = @(
  "-h", $(if ([string]::IsNullOrWhiteSpace($HostName)) { "127.0.0.1" } else { $HostName }),
  "-P", $(if ([string]::IsNullOrWhiteSpace($Port)) { "3306" } else { $Port }),
  "-u", $(if ([string]::IsNullOrWhiteSpace($User)) { "root" } else { $User })
)

if (-not [string]::IsNullOrWhiteSpace($Password)) {
  $dumpArgs += "-p$Password"
}

& $MysqlDumpPath @dumpArgs --databases $DatabaseName --routines --events --triggers --single-transaction --result-file=$sqlPath

if ($LASTEXITCODE -ne 0) {
  Write-Error "Database backup failed."
  exit $LASTEXITCODE
}

$uploadsPath = Join-Path (Split-Path $PSScriptRoot -Parent) "public\uploads"
if (Test-Path $uploadsPath) {
  $zipPath = Join-Path $storageBackupDir "uploads-$timestamp.zip"
  Compress-Archive -Path (Join-Path $uploadsPath "*") -DestinationPath $zipPath -Force
  Write-Host "Storage backup written to $zipPath"
}

Write-Host "Database backup written to $sqlPath"
