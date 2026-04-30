# TaskFlow AI — Enhancement Roadmap (TODO)

---

## Phase 0: Critical Fixes (Security & Foundation)

### 🔒 Security Hardening

- [ ] Remove hardcoded `AUTH_SECRET` fallback in `session.ts` — must throw error if env var is missing
- [ ] Add rate limiting on login, signup, password reset, and AI endpoints
- [ ] Add CSRF protection on all mutation routes (POST/PUT/DELETE)
- [ ] Add Content-Security-Policy headers in `next.config.mjs`
- [ ] Remove `localStorage` user storage — read user from HTTP-only session cookie via server components or `/api/me`
- [ ] Add Zod schema validation on all API route request bodies

### 📧 Email Infrastructure

- [ ] Integrate email provider (Resend / SendGrid / Nodemailer)
- [ ] Send actual password reset emails
- [ ] Send team invitation emails
- [ ] Send notification digest emails

### 🧪 Testing Foundation

- [ ] Add API endpoint tests (Vitest/Jest) — login, signup, task CRUD, auth middleware
- [ ] Add component render tests (React Testing Library) — sidebar, dashboard, task cards
- [ ] Add at least 1 E2E test (Playwright/Cypress) — login → create workspace → create task flow

---

## Phase 1: UI/UX Overhaul

### 🎨 Landing Page

- [ ] Replace placeholder hero section with real product screenshot or animated demo
- [ ] Add testimonial/social proof section with faces, logos, and quotes
- [ ] Add "How it Works" 3-step visual walkthrough section
- [ ] Add animated gradient or particle background to hero
- [ ] Add customer logos / trust badges strip

### 🖥️ Dashboard & App Shell

- [ ] Add Framer Motion page transitions and card entrance animations
- [ ] Replace "Loading..." text with Skeleton UI placeholders
- [ ] Replace "No data" text with SVG illustrations and clear CTAs
- [ ] Improve metric cards — add trend indicators (↑12%), sparkline charts, color coding
- [ ] Wire up Sonner toasts for every create/update/delete action

### 🌐 Global UI

- [ ] Wire up `cmdk` Command Palette (Ctrl+K) for search, navigation, quick actions
- [ ] Add bottom navigation bar on mobile
- [ ] Add swipe-to-dismiss on modals for mobile
- [ ] Audit and fix dark mode contrast issues on all pages/charts/modals
- [ ] Add smooth scroll behavior and scroll-to-top button

---

## Phase 2: Core Feature Deepening

### ✅ Task Management

- [ ] Add drag-and-drop Kanban board using `@dnd-kit`
- [ ] Add rich text editor (Tiptap/Plate) for task descriptions
- [ ] Add task dependencies (`depends_on` relationship)
- [ ] Add time tracking (start/stop timer per task)
- [ ] Add task templates (save and reuse common structures)
- [ ] Add bulk task actions (select multiple → update status/assignee/labels)

### 💬 Collaboration

- [ ] Add real-time updates via WebSocket (replace SSE polling)
- [ ] Add @mention autocomplete dropdown in comments and chat
- [ ] Add inline file preview for image/PDF attachments
- [ ] Add typing indicators in workspace chat

### 📝 Notes & Docs

- [ ] Add collaborative real-time editing (Yjs / Liveblocks)
- [ ] Add version history diff viewer UI for `note_revisions`
- [ ] Add markdown preview toggle

### 🔍 Search & Filters

- [ ] Add saved custom views (complex filter combos saved as named views)
- [ ] Add full-text search across tasks, notes, comments, and chat

---

## Phase 3: Infrastructure & Scalability

### ☁️ Cloud Storage

- [ ] Migrate uploads from local `/public/uploads` to AWS S3 or Cloudflare R2
- [ ] Add presigned URL generation for secure file uploads/downloads

### ⚡ Performance

- [ ] Move dashboard data fetching to server components (reduce client-side rendering)
- [ ] Add Redis caching for dashboard stats and workspace lists
- [ ] Make DB connection pool limit configurable via env vars
- [ ] Add database health check queries

### 📊 Observability

- [ ] Replace `console.error` with structured logging (Pino)
- [ ] Integrate Sentry for error monitoring and alerting
- [ ] Add API response time tracking middleware

### 🚀 CI/CD

- [ ] Add GitHub Actions pipeline: lint → type-check → test → build
- [ ] Set up Vercel preview deployments for every PR
- [ ] Add automated dependency updates (Dependabot/Renovate)

---

## Phase 4: Advanced AI & Automation

### 🤖 AI Enhancements

- [ ] Add streaming AI responses (Gemini `generateContentStream`)
- [ ] Add conversation memory management (summarize old messages to stay within token limits)
- [ ] Add AI-powered task creation (AI generates real DB task rows, not just text)
- [ ] Add smart triage (auto-categorize and prioritize incoming tasks)
- [ ] Add voice-to-task using Web Speech API
- [ ] Add context-aware document generation (AI drafts reports from workspace data)

### ⚙️ Automation Engine

- [ ] Build visual node-based automation builder (like Zapier)
- [ ] Add more trigger types: task assigned, label changed, comment added, milestone reached
- [ ] Add webhook triggers (external services trigger automations)
- [ ] Add cron-style scheduled automations (e.g., "every Monday 9 AM")
- [ ] Add automation logs dashboard with run history and error details

---

## Phase 5: Monetization & Growth

### 💳 Payment Integration

- [ ] Integrate Stripe or Razorpay for subscription payments
- [ ] Build plan management UI (upgrade/downgrade/cancel)
- [ ] Add invoice generation and billing history page
- [ ] Add usage-based billing for AI (track Gemini token usage per user)
- [ ] Add feature gating (Free = 3 workspaces, Pro = unlimited, etc.)

### 🎯 Onboarding

- [ ] Add interactive onboarding tour (step-by-step tooltip guide)
- [ ] Add pre-built workspace templates ("Software Project", "Marketing Campaign", etc.)
- [ ] Add demo mode (try dashboard without signing up, read-only sample data)

### 📈 Growth & Analytics

- [ ] Integrate user analytics (PostHog / Mixpanel) — track feature adoption, retention
- [ ] Add referral system ("Invite 3 friends, get 1 month Pro free")
- [ ] Add `/blog` section for SEO content pages
- [ ] Add changelog page to announce new features

---

## Phase 6: Ecosystem & Enterprise

### 🔗 Third-Party Integrations

- [ ] GitHub integration — sync PRs/issues to tasks, auto-update status on merge
- [ ] Slack/Discord bot — send notifications, create tasks from chat
- [ ] Google Calendar two-way sync for task due dates
- [ ] Zapier/Make connector — expose public API for 5000+ app connections
- [ ] Developer API with API key management and documentation

### 🏢 Enterprise Features

- [ ] SSO support (SAML / OIDC) — Okta, Azure AD, Google Workspace
- [ ] Audit logging — log every user action with IP, timestamp, actor
- [ ] Full workspace data export (JSON/CSV)
- [ ] Super-admin panel — manage users, billing, system health
- [ ] Granular RBAC enforcement — enforce `owner/admin/member/viewer` roles on every UI action
- [ ] Multi-tenant architecture with workspace isolation
- [ ] SLA monitoring and uptime dashboard

---

## Progress Tracker

| Phase                     | Items  | Completed | Status         |
| ------------------------- | ------ | --------- | -------------- |
| Phase 0 — Critical Fixes  | 13     | 0         | 🔴 Not Started |
| Phase 1 — UI/UX Overhaul  | 15     | 0         | 🔴 Not Started |
| Phase 2 — Core Features   | 16     | 0         | 🔴 Not Started |
| Phase 3 — Infrastructure  | 11     | 0         | 🔴 Not Started |
| Phase 4 — AI & Automation | 11     | 0         | 🔴 Not Started |
| Phase 5 — Monetization    | 12     | 0         | 🔴 Not Started |
| Phase 6 — Enterprise      | 12     | 0         | 🔴 Not Started |
| **Total**                 | **90** | **0**     | 🔴             |
