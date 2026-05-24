# Manage One AI

Manage One AI is a full-stack productivity workspace built with Next.js, MySQL, and a Python backend scaffold for future service expansion.

## Stack

- `Next.js 16` frontend and route handlers
- `MySQL` via XAMPP
- `FastAPI` scaffold in `backend/`
- `Tailwind CSS` UI layer

## Local Setup

1. Start XAMPP and ensure MySQL is running.
2. Copy `.env.example` to `.env.local` and fill in values.
3. Apply the schema:

```powershell
.\database\migrate.ps1
```

To load demo data too:

```powershell
.\database\migrate.ps1 -Seed
```

4. Start the frontend:

```powershell
npm.cmd run dev
```

5. Optional Python backend:

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

## Auth Notes

- Email signup/login is implemented with MySQL-backed users.
- Session auth uses a signed HTTP-only cookie.
- Forgot password works with reset tokens stored in MySQL.
- Google sign-in is implemented and becomes active after setting `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- Seeded demo login, after running `.\database\migrate.ps1 -Seed`: `asha@example.com` / `TaskFlow123!`.

## Database Notes

- Schema, relationships, indexes, and seed data live in `database/`.
- Test database setup: `npm run db:test`.
- Local backup: `npm run db:backup`.
- Restore workflow and exact commands are documented in `database/README.md`.

## Testing Notes

- Smoke test suite: `npm.cmd test`.
- Deliverables check: `npm.cmd run test:deliverables`.
- Product goals check: `npm.cmd run test:goals`.
- Build order check: `npm.cmd run test:build-order`.
- Progress status check: `npm.cmd run test:progress`.
- Type check: `npm.cmd run test:types`.
- Production build test: `npm.cmd run test:build`.
- Full testing workflow is documented in `docs/TESTING.md`.

## AI Assistant Notes

- The assistant stores conversation history in MySQL and supports prompt templates plus usage logging.
- If `GEMINI_API_KEY` is set, assistant replies use the Gemini Developer API with `GEMINI_MODEL`.
- Without an API key, the assistant falls back to local workspace-aware heuristics for summaries, task generation, and recommendations.

## Project Tracking

- Master checklist: [PROJECT_TODO.md](./PROJECT_TODO.md)
- Branding reference: [BRANDING.md](./BRANDING.md)
- Workflow notes: [docs/PROJECT_MANAGEMENT.md](./docs/PROJECT_MANAGEMENT.md)
- Current progress status: [docs/PROGRESS_STATUS.md](./docs/PROGRESS_STATUS.md)

## Final Deliverables

- Deliverables index: [docs/FINAL_DELIVERABLES.md](./docs/FINAL_DELIVERABLES.md)
- System architecture: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- UML diagrams: [docs/UML.md](./docs/UML.md)
- Implementation results: [docs/IMPLEMENTATION_RESULTS.md](./docs/IMPLEMENTATION_RESULTS.md)
- Report screenshots guide: [docs/REPORT_SCREENSHOTS.md](./docs/REPORT_SCREENSHOTS.md)
- Demo presentation: [docs/DEMO_PRESENTATION.md](./docs/DEMO_PRESENTATION.md)
- Deployment package: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- Final product goals: [docs/PRODUCT_GOALS.md](./docs/PRODUCT_GOALS.md)
- Recommended build order: [docs/BUILD_ORDER.md](./docs/BUILD_ORDER.md)
- Progress status: [docs/PROGRESS_STATUS.md](./docs/PROGRESS_STATUS.md)

