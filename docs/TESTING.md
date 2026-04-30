# Testing

TaskFlow AI uses lightweight repository tests that can run without adding a new test framework.

## Core Checks

```powershell
npm.cmd test
```

The smoke suite covers:

- Login and auth flow wiring
- API route surface and middleware helpers
- Database schema, seed data, backup/restore, and test database scripts
- Collaboration streams, presence, shared docs, mentions, and notifications
- AI assistant, prompt templates, provider fallback, and multi-agent traces
- Public/auth/dashboard route connectivity
- Regression checks for dead links, remote font fetching, and invalid replacement characters
- Production build readiness

## Type Check

```powershell
npm.cmd run test:types
```

## Deliverables Check

```powershell
npm.cmd run test:deliverables
```

## Product Goals Check

```powershell
npm.cmd run test:goals
```

## Build Order Check

```powershell
npm.cmd run test:build-order
```

## Progress Status Check

```powershell
npm.cmd run test:progress
```

## Production Build Test

```powershell
npm.cmd run test:build
```

Next.js may need permission to spawn worker processes in restricted shells.

## Optional Database Test

Start XAMPP MySQL, then run:

```powershell
npm.cmd run db:test
```

This rebuilds `taskflow_auth_test` with seed data.
