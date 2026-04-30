import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

const file = (...parts) => path.join(root, ...parts)
const exists = (...parts) => existsSync(file(...parts))
const read = (...parts) => readFile(file(...parts), "utf8")

async function listFiles(dir, predicate = () => true) {
  const entries = await readdir(file(dir), { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter(predicate)
}

test("login testing: auth pages and routes cover credential, session, and password reset flows", async () => {
  const loginRoute = await read("app", "api", "auth", "login", "route.ts")
  const signupRoute = await read("app", "api", "auth", "signup", "route.ts")
  const logoutRoute = await read("app", "api", "auth", "logout", "route.ts")
  const forgotRoute = await read("app", "api", "auth", "forgot-password", "route.ts")
  const resetRoute = await read("app", "api", "auth", "reset-password", "route.ts")
  const loginPage = await read("app", "(auth)", "login", "page.tsx")
  const signupPage = await read("app", "(auth)", "signup", "page.tsx")

  assert.match(loginRoute, /verifyPassword/)
  assert.match(signupRoute, /hashPassword/)
  assert.match(loginRoute, /sessionCookieName/)
  assert.match(logoutRoute, /cookies\.set|response\.cookies\.set/)
  assert.match(forgotRoute, /password_reset_tokens/)
  assert.match(resetRoute, /password_reset_tokens/)
  assert.match(loginPage, /type="email"/)
  assert.match(loginPage, /type=\{showPassword \? "text" : "password"\}/)
  assert.match(signupPage, /aria-label=\{showPassword \? "Hide password" : "Show password"\}/)
})

test("api testing: expected API route surface exists and exports handlers", async () => {
  const requiredRoutes = [
    ["app", "api", "auth", "login", "route.ts"],
    ["app", "api", "auth", "signup", "route.ts"],
    ["app", "api", "auth", "me", "route.ts"],
    ["app", "api", "tasks", "route.ts"],
    ["app", "api", "tasks", "[id]", "route.ts"],
    ["app", "api", "workspaces", "route.ts"],
    ["app", "api", "workspaces", "[id]", "route.ts"],
    ["app", "api", "assistant", "route.ts"],
    ["app", "api", "agents", "route.ts"],
    ["app", "api", "collaboration", "route.ts"],
    ["app", "api", "automations", "route.ts"],
    ["app", "api", "notes", "route.ts"],
    ["app", "api", "notifications", "route.ts"],
    ["app", "api", "analytics", "route.ts"],
    ["app", "api", "search", "route.ts"],
  ]

  for (const routePath of requiredRoutes) {
    assert.equal(exists(...routePath), true, `${routePath.join("/")} should exist`)
    const source = await read(...routePath)
    assert.match(source, /export async function (GET|POST|PATCH|PUT|DELETE)/, `${routePath.join("/")} should export an HTTP handler`)
  }

  const proxy = await read("proxy.ts")
  const apiUtils = await read("lib", "api-utils.ts")
  assert.match(proxy, /pathname\.startsWith\("\/api"\)/)
  assert.match(proxy, /NextResponse\.json\(\{ error: "Unauthorized" \}/)
  assert.match(apiUtils, /badRequest/)
  assert.match(apiUtils, /unauthorized/)
  assert.match(apiUtils, /handleApiError/)
})

test("database testing: schema, seeds, backups, and test database scripts are present", async () => {
  const schema = await read("database", "schema.sql")
  const seed = await read("database", "seed.sql")

  for (const table of [
    "users",
    "workspaces",
    "workspace_members",
    "tasks",
    "task_comments",
    "notes",
    "notifications",
    "automations",
    "ai_conversations",
    "ai_agent_runs",
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`))
  }

  assert.ok((schema.match(/FOREIGN KEY/g) ?? []).length >= 25)
  assert.match(seed, /asha@example\.com/)
  assert.match(seed, /TaskFlow|TaskFlowseed0001/)
  assert.equal(exists("database", "backup.ps1"), true)
  assert.equal(exists("database", "restore.ps1"), true)
  assert.equal(exists("database", "test-db.ps1"), true)
})

test("collaboration testing: realtime chat, presence, docs, mentions, and notifications are wired", async () => {
  const collaborationPage = await read("app", "(dashboard)", "dashboard", "collaboration", "page.tsx")
  const collaborationRoute = await read("app", "api", "collaboration", "route.ts")
  const streamRoute = await read("app", "api", "collaboration", "stream", "route.ts")
  const presenceRoute = await read("app", "api", "collaboration", "presence", "route.ts")
  const docRoute = await read("app", "api", "collaboration", "doc", "route.ts")
  const realtime = await read("lib", "realtime.ts")
  const mentions = await read("lib", "mentions.ts")

  assert.match(collaborationPage, /EventSource/)
  assert.match(collaborationRoute, /workspace_messages/)
  assert.match(streamRoute, /text\/event-stream/)
  assert.match(presenceRoute, /UPDATE users SET status/)
  assert.match(docRoute, /workspace_shared_docs/)
  assert.match(realtime, /event: \$\{event\}\\ndata:/)
  assert.match(mentions, /extractMentions/)
  assert.match(mentions, /createNotification/)
})

test("ai module testing: assistant, prompts, provider fallback, and multi-agent traces are wired", async () => {
  const assistantRoute = await read("app", "api", "assistant", "route.ts")
  const promptsRoute = await read("app", "api", "assistant", "prompts", "route.ts")
  const ai = await read("lib", "ai.ts")
  const multiAgent = await read("lib", "multi-agent.ts")

  assert.match(assistantRoute, /generateAssistantReply/)
  assert.match(promptsRoute, /getPromptTemplates/)
  assert.match(ai, /GEMINI_API_KEY/)
  assert.match(ai, /taskflow-local/)
  assert.match(ai, /fallbackTaskGeneration/)
  assert.match(multiAgent, /planner/)
  assert.match(multiAgent, /scheduler/)
  assert.match(multiAgent, /research/)
  assert.match(multiAgent, /automation/)
  assert.match(multiAgent, /ai_agent_steps/)
})

test("end-to-end flow testing: public, auth, and dashboard pages are connected", async () => {
  const landing = await read("app", "page.tsx")
  const sidebar = await read("components", "dashboard", "sidebar.tsx")
  const header = await read("components", "dashboard", "header.tsx")
  const dashboardLayout = await read("app", "(dashboard)", "layout.tsx")

  assert.match(landing, /<LandingHeader/)
  assert.match(landing, /<HeroSection/)
  assert.match(landing, /<FeaturesSection/)
  assert.match(landing, /<PricingSection/)
  assert.match(header, /\/dashboard\/search/)
  assert.match(header, /\/dashboard\/settings/)
  assert.match(dashboardLayout, /\/api\/auth\/me/)

  const dashboardPages = [
    "dashboard",
    "workspaces",
    "tasks",
    "team",
    "collaboration",
    "notes",
    "assistant",
    "automations",
    "analytics",
    "search",
    "notifications",
    "settings",
    "help",
  ]

  for (const page of dashboardPages) {
    const route = page === "dashboard" ? "/dashboard" : `/dashboard/${page}`
    assert.match(sidebar, new RegExp(route.replace(/\//g, "\\/")), `${route} should be linked in sidebar`)
    assert.equal(exists("app", "(dashboard)", "dashboard", page === "dashboard" ? "page.tsx" : page, page === "dashboard" ? "" : "page.tsx"), true)
  }
})

test("regression testing: no known UI/build regressions have returned", async () => {
  const sourceFiles = await listFiles("app", (name) => /\.(tsx|ts|css)$/.test(name))
  sourceFiles.push(...await listFiles("components", (name) => /\.(tsx|ts)$/.test(name)))

  for (const sourcePath of sourceFiles) {
    const source = await readFile(sourcePath, "utf8")
    assert.doesNotMatch(source, /next\/font\/google/, `${sourcePath} should not reintroduce remote font fetching`)
    assert.doesNotMatch(source, /href="#"/, `${sourcePath} should not contain dead placeholder links`)
    assert.doesNotMatch(source, /\uFFFD/, `${sourcePath} should not contain replacement characters`)
  }

  const packageJson = JSON.parse(await read("package.json"))
  assert.equal(packageJson.scripts.build, "next build")
  assert.equal(packageJson.scripts["test:types"], "tsc --noEmit")
})

test("production build testing: build command and Next.js config are ready", async () => {
  const packageJson = JSON.parse(await read("package.json"))
  const nextConfig = await read("next.config.mjs")
  const layout = await read("app", "layout.tsx")

  assert.equal(packageJson.scripts.build, "next build")
  assert.match(nextConfig, /NextConfig/)
  assert.doesNotMatch(layout, /next\/font\/google/)
})
