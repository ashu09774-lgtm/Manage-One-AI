# Deployment Package

## Production Build

```powershell
npm.cmd run test:build
```

This runs `next build` and verifies production route generation.

## Environment Variables

Copy `.env.example` to `.env.local` for local development or configure the same keys in the hosting provider.

Required:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `AUTH_SECRET`

Optional:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Database Preparation

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
```

For a clean test database:

```powershell
npm.cmd run db:test
```

## Local Production Run

```powershell
npm.cmd run build
npm.cmd run start
```

Default URL:

```text
http://localhost:3000
```

## Package Contents

- `app/`: frontend pages and API routes
- `components/`: UI components
- `lib/`: shared services
- `database/`: schema, seed, backup, restore, test database scripts
- `docs/`: architecture, UML, testing, deployment, presentation, report notes
- `public/`: icons and upload storage root

## Release Checklist

- Run `npm.cmd test`
- Run `npm.cmd run test:types`
- Run `npm.cmd run test:build`
- Confirm `.env.local` or host variables are configured
- Confirm MySQL is reachable from the app runtime
- Configure persistent upload storage for task attachments
- Configure Google OAuth client ID if Google sign-in is required
- Configure Gemini API key if provider-backed AI responses are required
