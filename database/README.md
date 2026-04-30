# Database Workflow

TaskFlow AI uses MySQL through XAMPP. The schema is maintained in `schema.sql`; helper scripts keep local setup, demo data, backups, and test databases repeatable.

## Apply Schema

```powershell
.\database\migrate.ps1
```

## Apply Schema with Demo Data

```powershell
.\database\migrate.ps1 -Seed
```

Demo login:

- Email: `asha@example.com`
- Password: `Taskflow123!`

## Rebuild Test Database

```powershell
.\database\test-db.ps1
```

This creates `taskflow_auth_test`, resets it, and loads the seed data.

## Back Up Local Data

```powershell
.\database\backup.ps1
```

Backups are written under `database/backups/`. SQL dumps and uploaded files are intentionally ignored by Git.

## Restore Local Data

```powershell
.\database\restore.ps1 -SqlPath .\database\backups\db\taskflow_auth-YYYYMMDD-HHMMSS.sql
```

To restore uploaded files too:

```powershell
.\database\restore.ps1 -SqlPath .\database\backups\db\taskflow_auth-YYYYMMDD-HHMMSS.sql -StorageZipPath .\database\backups\storage\uploads-YYYYMMDD-HHMMSS.zip
```
