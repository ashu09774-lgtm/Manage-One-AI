import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const file = (...parts) => path.join(root, ...parts)
const exists = (...parts) => existsSync(file(...parts))
const read = (...parts) => readFile(file(...parts), "utf8")

test("recommended build order: auth phase is complete", async () => {
  const proxy = await read("proxy.ts")
  const session = await read("lib", "session.ts")
  const password = await read("lib", "password.ts")

  assert.equal(exists("app", "(auth)", "login", "page.tsx"), true)
  assert.equal(exists("app", "(auth)", "signup", "page.tsx"), true)
  assert.equal(exists("app", "api", "auth", "login", "route.ts"), true)
  assert.equal(exists("app", "api", "auth", "signup", "route.ts"), true)
  assert.match(proxy, /\/dashboard/)
  assert.match(session, /createSessionToken|verifySessionToken/)
  assert.match(password, /hashPassword|verifyPassword/)
})

test("recommended build order: dashboard phase is complete", async () => {
  const dashboard = await read("app", "(dashboard)", "dashboard", "page.tsx")
  const layout = await read("app", "(dashboard)", "layout.tsx")
  const sidebar = await read("components", "dashboard", "sidebar.tsx")
  const header = await read("components", "dashboard", "header.tsx")

  assert.match(dashboard, /MetricCard|Recent Tasks|Team Activity/)
  assert.match(layout, /DashboardSidebar/)
  assert.match(sidebar, /Dashboard|Workspaces|Tasks/)
  assert.match(header, /\/dashboard\/search/)
})

test("recommended build order: task management phase is complete", async () => {
  const tasksPage = await read("app", "(dashboard)", "dashboard", "tasks", "page.tsx")
  const tasksRoute = await read("app", "api", "tasks", "route.ts")
  const taskRoute = await read("app", "api", "tasks", "[id]", "route.ts")

  assert.match(tasksPage, /list|board|calendar/i)
  assert.match(tasksPage, /Subtasks|Comments|Attachments/i)
  assert.match(tasksRoute, /INSERT INTO tasks/)
  assert.match(taskRoute, /UPDATE tasks/)
  assert.equal(exists("app", "api", "tasks", "[id]", "comments", "route.ts"), true)
  assert.equal(exists("app", "api", "tasks", "[id]", "attachments", "route.ts"), true)
})

test("recommended build order: workspace phase is complete", async () => {
  const workspaces = await read("app", "(dashboard)", "dashboard", "workspaces", "page.tsx")
  const workspaceDetail = await read("app", "(dashboard)", "dashboard", "workspaces", "[id]", "page.tsx")

  assert.match(workspaces, /New Workspace|Open Workspace/)
  assert.match(workspaceDetail, /Members|Projects|Timeline|Settings/i)
  assert.equal(exists("app", "api", "workspaces", "route.ts"), true)
  assert.equal(exists("app", "api", "workspaces", "[id]", "projects", "route.ts"), true)
  assert.equal(exists("app", "api", "workspaces", "[id]", "members", "route.ts"), true)
})

test("recommended build order: AI assistant phase is complete", async () => {
  const assistantPage = await read("app", "(dashboard)", "dashboard", "assistant", "page.tsx")
  const ai = await read("lib", "ai.ts")

  assert.match(assistantPage, /AI Assistant|Prompt|template/i)
  assert.match(ai, /generateAssistantReply/)
  assert.match(ai, /GEMINI_API_KEY/)
  assert.equal(exists("app", "api", "assistant", "route.ts"), true)
  assert.equal(exists("app", "api", "assistant", "prompts", "route.ts"), true)
})

test("recommended build order: collaboration phase is complete", async () => {
  const collaboration = await read("app", "(dashboard)", "dashboard", "collaboration", "page.tsx")
  const realtime = await read("lib", "realtime.ts")

  assert.match(collaboration, /EventSource|Team Chat|shared brief/i)
  assert.match(realtime, /ReadableStream|emitWorkspaceEvent/)
  assert.equal(exists("app", "api", "collaboration", "route.ts"), true)
  assert.equal(exists("app", "api", "collaboration", "stream", "route.ts"), true)
  assert.equal(exists("app", "api", "collaboration", "presence", "route.ts"), true)
})

test("recommended build order: automation phase is complete", async () => {
  const automations = await read("app", "(dashboard)", "dashboard", "automations", "page.tsx")
  const automationLib = await read("lib", "automations.ts")

  assert.match(automations, /Workflow Builder|Run Logs|Smart Suggestions/i)
  assert.match(automationLib, /runAutomation/)
  assert.equal(exists("app", "api", "automations", "route.ts"), true)
  assert.equal(exists("app", "api", "automations", "[id]", "run", "route.ts"), true)
})

test("recommended build order: multi-agent phase is complete", async () => {
  const multiAgent = await read("lib", "multi-agent.ts")
  const schema = await read("database", "schema.sql")

  assert.match(multiAgent, /planner/)
  assert.match(multiAgent, /scheduler/)
  assert.match(multiAgent, /research/)
  assert.match(multiAgent, /automation/)
  assert.match(schema, /ai_agent_runs/)
  assert.match(schema, /ai_agent_steps/)
  assert.equal(exists("app", "api", "agents", "route.ts"), true)
})

test("recommended build order: analytics phase is complete", async () => {
  const analytics = await read("app", "(dashboard)", "dashboard", "analytics", "page.tsx")
  const analyticsRoute = await read("app", "api", "analytics", "route.ts")

  assert.match(analytics, /Productivity|Completion|Team Performance|Export/i)
  assert.match(analyticsRoute, /completionRate|teamPerformance|priorityBreakdown/)
})

test("recommended build order: final polish phase is complete", async () => {
  const globals = await read("app", "globals.css")
  const projectTodo = await read("PROJECT_TODO.md")
  const buildOrder = await read("docs", "BUILD_ORDER.md")

  assert.match(globals, /skip-link/)
  assert.match(projectTodo, /UI\/UX completion now/)
  assert.match(buildOrder, /Dependency Flow/)
  assert.equal(exists("docs", "FINAL_DELIVERABLES.md"), true)
  assert.equal(exists("tests", "smoke.test.mjs"), true)
  assert.equal(exists("tests", "deliverables.test.mjs"), true)
  assert.equal(exists("tests", "product-goals.test.mjs"), true)
})
