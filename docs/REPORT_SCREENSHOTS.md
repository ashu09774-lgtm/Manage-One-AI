# Report Screenshots

Use this checklist for final report screenshots. The app routes are already present and production-build verified.

## Recommended Screenshots

| Screenshot         | Route                      | Purpose                                |
| ------------------ | -------------------------- | -------------------------------------- |
| Landing page       | `/`                        | Product overview and branding          |
| Login page         | `/login`                   | Authentication entry point             |
| Dashboard overview | `/dashboard`               | KPIs, recent tasks, workspace activity |
| Tasks list         | `/dashboard/tasks`         | Task CRUD, filters, list view          |
| Tasks board        | `/dashboard/tasks`         | Kanban workflow view                   |
| Workspaces         | `/dashboard/workspaces`    | Workspace cards and progress           |
| Collaboration      | `/dashboard/collaboration` | Chat, shared docs, presence/activity   |
| AI Assistant       | `/dashboard/assistant`     | AI chat, templates, multi-agent runs   |
| Automations        | `/dashboard/automations`   | Workflow builder and logs              |
| Analytics          | `/dashboard/analytics`     | Charts, insights, export               |
| Notifications      | `/dashboard/notifications` | Notification center and preferences    |
| Settings           | `/dashboard/settings`      | Profile, security, roles, preferences  |

## Capture Setup

1. Start XAMPP MySQL.
2. Seed demo data:

```powershell
npm.cmd run db:seed
```

3. Start the app:

```powershell
npm.cmd run dev
```

4. Log in with:

- Email: `asha@example.com`
- Password: `TaskFlow123!`

## Suggested Report Captions

- "TaskFlow AI landing page with product positioning and primary call to action."
- "Dashboard overview showing workspace metrics, activity, and task progress."
- "Task management module supporting list, Kanban, calendar, labels, subtasks, comments, and attachments."
- "AI assistant module with workspace-aware responses and multi-agent orchestration traces."
- "Analytics dashboard summarizing completion trends, priorities, team performance, and AI-style insights."
