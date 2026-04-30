# System Architecture

TaskFlow AI is a full-stack productivity workspace built around a Next.js application, MySQL persistence, server-side API route handlers, and optional AI provider integration.

## High-Level Architecture

```mermaid
flowchart LR
  user[User Browser]
  next[Next.js App Router]
  ui[React Dashboard UI]
  api[API Route Handlers]
  proxy[Session Proxy]
  mysql[(MySQL / XAMPP)]
  uploads[Local Upload Storage]
  ai[Gemini API Optional]
  local[Local AI Fallback]
  sse[SSE Realtime Streams]

  user --> next
  next --> ui
  next --> proxy
  proxy --> api
  api --> mysql
  api --> uploads
  api --> sse
  api --> ai
  api --> local
  sse --> user
```

## Runtime Components

- `app/`: Next.js App Router pages and API route handlers.
- `components/`: dashboard, landing, auth, and shared UI components.
- `lib/`: shared service modules for database, auth/session, API utilities, AI, automation, realtime, notifications, and mentions.
- `database/`: MySQL schema, seed data, migration, backup, restore, and test database scripts.
- `public/uploads/`: local task attachment storage.
- `backend/`: FastAPI scaffold reserved for future Python service expansion.

## Request Flow

```mermaid
sequenceDiagram
  participant B as Browser
  participant P as Proxy
  participant A as API Route
  participant D as MySQL

  B->>P: Dashboard/API request
  P->>P: Verify signed session cookie
  alt Valid session
    P->>A: Forward request
    A->>D: Query or mutate workspace data
    D-->>A: Result rows
    A-->>B: JSON response
  else Invalid session
    P-->>B: Redirect to login or 401 JSON
  end
```

## Data and Feature Areas

```mermaid
flowchart TB
  auth[Authentication]
  workspace[Workspaces and Projects]
  tasks[Tasks, Labels, Comments, Attachments]
  collaboration[Chat, Presence, Shared Docs, Activity]
  ai[AI Assistant and Multi-Agent Runs]
  automation[Automation Rules and Runs]
  analytics[Analytics and Search]
  notifications[Notifications]

  auth --> workspace
  workspace --> tasks
  workspace --> collaboration
  workspace --> ai
  workspace --> automation
  tasks --> analytics
  tasks --> notifications
  collaboration --> notifications
  automation --> notifications
```

## Deployment Shape

```mermaid
flowchart LR
  app[Next.js Runtime]
  db[(MySQL Database)]
  fs[Persistent Upload Storage]
  env[Environment Variables]

  env --> app
  app --> db
  app --> fs
```

Minimum required environment:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `AUTH_SECRET`

Optional integrations:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
