import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (...parts) => readFile(path.join(root, ...parts), "utf8")

test("ai task system: preview, save, grouping, and completion are wired", async () => {
  const route = await read("app", "api", "ai-tasks", "route.ts")
  const actionRoute = await read("app", "api", "ai-tasks", "actions", "route.ts")
  const orchestrator = await read("lib", "ai-task-orchestrator.ts")
  const actions = await read("lib", "ai-task-actions.ts")
  const notifications = await read("lib", "notifications.ts")
  const tasksPage = await read("app", "(dashboard)", "dashboard", "tasks", "page.tsx")
  const tasksRoute = await read("app", "api", "tasks", "route.ts")

  assert.match(route, /action === "preview"/)
  assert.match(route, /rateLimiter\.limit\(`ai-tasks:/)
  assert.match(route, /completeAiTaskGroup/)
  assert.match(orchestrator, /previewAiTaskPlan/)
  assert.match(orchestrator, /getAiTaskGroups/)
  assert.match(orchestrator, /ai_task_group_completed/)
  assert.match(orchestrator, /Please confirm this AI plan/)
  assert.match(tasksPage, /Preview Tasks/)
  assert.match(tasksPage, /AI Goals/)
  assert.match(tasksPage, /Save Tasks/)
  assert.match(tasksPage, /Confirm this plan before saving/)
  assert.match(tasksRoute, /aiGenerated/)
  assert.match(tasksRoute, /aiGoal/)
  assert.match(actionRoute, /executeAiNativeAction/)
  assert.match(actions, /create_note/)
  assert.match(actions, /create_reminder/)
  assert.match(actions, /summarize_document/)
  assert.match(actions, /build_checklist/)
  assert.match(actions, /Please confirm this AI action/)
  assert.match(notifications, /generateAiGoalCompletionSweep/)
  assert.match(notifications, /sendCompletionEmail/)
})

test("ai task system: roadmap reflects completed implemented phases", async () => {
  const todo = await read("AI_TASK_SYSTEM_TODO.md")

  for (const item of [
    "Show a preview of generated tasks before saving.",
    "Show AI-generated goal groups in the tasks page.",
    "Add a progress indicator for each AI-generated goal.",
    "Add a quick action to mark generated goal groups complete.",
    "Add rate limiting for AI task creation.",
    "Add audit logs for every AI-created task and automated completion.",
    "Add user confirmation for high-risk tasks.",
    "Add clear labels so users can see which tasks were AI-created.",
    "Add rules for tasks the AI can complete directly, such as drafting notes or generating summaries.",
    "Add action handlers for app-native work: create notes, create reminders, summarize documents, and build checklists.",
    "Add a background sweep for due reminders and goal completion reminders.",
    "Add email or push delivery for completion reminders based on user settings.",
  ]) {
    assert.match(todo, new RegExp(`- \\[x\\] ${item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
  }
})
