import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const file = (...parts) => path.join(root, ...parts)
const exists = (...parts) => existsSync(file(...parts))
const read = (...parts) => readFile(file(...parts), "utf8")

test("product goal: AI productivity platform is implemented", async () => {
  const assistantPage = await read("app", "(dashboard)", "dashboard", "assistant", "page.tsx")
  const assistantRoute = await read("app", "api", "assistant", "route.ts")
  const promptsRoute = await read("app", "api", "assistant", "prompts", "route.ts")
  const aiLib = await read("lib", "ai.ts")
  const schema = await read("database", "schema.sql")

  assert.match(assistantPage, /AI Assistant|multi-agent|Prompt/i)
  assert.match(assistantRoute, /generateAssistantReply/)
  assert.match(promptsRoute, /getPromptTemplates/)
  assert.match(aiLib, /GEMINI_API_KEY/)
  assert.match(aiLib, /fallbackProductivity|fallbackTaskGeneration/)
  assert.match(schema, /ai_usage_logs/)
})

test("product goal: task management system is implemented", async () => {
  const tasksPage = await read("app", "(dashboard)", "dashboard", "tasks", "page.tsx")
  const tasksRoute = await read("app", "api", "tasks", "route.ts")
  const taskRoute = await read("app", "api", "tasks", "[id]", "route.ts")
  const schema = await read("database", "schema.sql")

  assert.match(tasksPage, /TabsTrigger value="list"/)
  assert.match(tasksPage, /TabsTrigger value="board"/)
  assert.match(tasksPage, /TabsTrigger value="calendar"/)
  assert.match(tasksRoute, /INSERT INTO tasks/)
  assert.match(taskRoute, /UPDATE tasks/)
  assert.match(taskRoute, /DELETE FROM tasks/)
  assert.match(schema, /task_comments/)
  assert.match(schema, /task_attachments/)
  assert.match(schema, /task_subtasks/)
  assert.match(schema, /task_labels/)
})

test("product goal: multi-agent workspace is implemented", async () => {
  const agentsRoute = await read("app", "api", "agents", "route.ts")
  const agentRoute = await read("app", "api", "agents", "[id]", "route.ts")
  const multiAgent = await read("lib", "multi-agent.ts")
  const schema = await read("database", "schema.sql")

  for (const agent of ["planner", "scheduler", "research", "automation"]) {
    assert.match(multiAgent, new RegExp(agent))
  }

  assert.match(agentsRoute, /createAgentRun|runAgentWorkflow/)
  assert.match(agentRoute, /getAgentRun/)
  assert.match(schema, /ai_agent_runs/)
  assert.match(schema, /ai_agent_steps/)
})

test("product goal: collaboration tool is implemented", async () => {
  const collaborationPage = await read("app", "(dashboard)", "dashboard", "collaboration", "page.tsx")
  const collaborationRoute = await read("app", "api", "collaboration", "route.ts")
  const streamRoute = await read("app", "api", "collaboration", "stream", "route.ts")
  const presenceRoute = await read("app", "api", "collaboration", "presence", "route.ts")
  const mentions = await read("lib", "mentions.ts")

  assert.match(collaborationPage, /shared brief|Team Chat|EventSource/i)
  assert.match(collaborationRoute, /workspace_messages/)
  assert.match(streamRoute, /text\/event-stream/)
  assert.match(presenceRoute, /status/)
  assert.match(mentions, /notifyMentionedUsers/)
})

test("product goal: workflow automation tool is implemented", async () => {
  const automationPage = await read("app", "(dashboard)", "dashboard", "automations", "page.tsx")
  const automationsRoute = await read("app", "api", "automations", "route.ts")
  const runRoute = await read("app", "api", "automations", "[id]", "run", "route.ts")
  const automationsLib = await read("lib", "automations.ts")
  const schema = await read("database", "schema.sql")

  assert.match(automationPage, /Workflow Builder|Run Logs|Smart Suggestions/i)
  assert.match(automationsRoute, /createAutomation|listAutomations/)
  assert.match(runRoute, /runAutomation/)
  assert.match(automationsLib, /recurring|due_soon|completion_follow_up/)
  assert.match(schema, /automation_runs/)
})

test("product goal: analytics dashboard is implemented", async () => {
  const analyticsPage = await read("app", "(dashboard)", "dashboard", "analytics", "page.tsx")
  const analyticsRoute = await read("app", "api", "analytics", "route.ts")

  assert.match(analyticsPage, /Productivity|Completion|Team Performance|Export/i)
  assert.match(analyticsRoute, /completionRate/)
  assert.match(analyticsRoute, /priorityBreakdown/)
  assert.match(analyticsRoute, /teamPerformance/)
  assert.match(analyticsRoute, /insights/)
})

test("product goal: SaaS-style full stack product is implemented", async () => {
  const landing = await read("app", "page.tsx")
  const proxy = await read("proxy.ts")
  const packageJson = JSON.parse(await read("package.json"))
  const readme = await read("README.md")
  const deployment = await read("docs", "DEPLOYMENT.md")
  const schema = await read("database", "schema.sql")

  assert.equal(exists("app", "(auth)", "login", "page.tsx"), true)
  assert.equal(exists("app", "(dashboard)", "dashboard", "settings", "page.tsx"), true)
  assert.equal(exists("app", "(dashboard)", "dashboard", "notifications", "page.tsx"), true)
  assert.match(landing, /LandingHeader/)
  assert.match(proxy, /\/dashboard/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS users/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS workspaces/)
  assert.equal(packageJson.scripts.build, "next build")
  assert.match(readme, /Local Setup/)
  assert.match(deployment, /Release Checklist/)
})

test("product goals documentation maps goals to implementation evidence", async () => {
  const goals = await read("docs", "PRODUCT_GOALS.md")

  for (const goal of [
    "AI productivity platform",
    "Task management system",
    "Multi-agent workspace",
    "Collaboration tool",
    "Workflow automation tool",
    "Analytics dashboard",
    "SaaS-style full stack product",
  ]) {
    assert.match(goals, new RegExp(goal, "i"))
  }

  assert.match(goals, /```mermaid/)
})
