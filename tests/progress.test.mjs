import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const file = (...parts) => path.join(root, ...parts)
const exists = (...parts) => existsSync(file(...parts))
const read = (...parts) => readFile(file(...parts), "utf8")

test("progress notes: status document exists and captures completion state", async () => {
  assert.equal(exists("docs", "PROGRESS_STATUS.md"), true)
  const status = await read("docs", "PROGRESS_STATUS.md")

  assert.match(status, /Sections `1-4` and `6-25` are complete/)
  assert.match(status, /Google OAuth/)
  assert.match(status, /NEXT_PUBLIC_GOOGLE_CLIENT_ID/)
  assert.match(status, /There is no unfinished internal module/)
})

test("progress notes: project todo marks section 25 complete and keeps external OAuth blocker explicit", async () => {
  const todo = await read("PROJECT_TODO.md")

  assert.match(todo, /Audit status for sections `1-25`/)
  assert.match(todo, /## 25\. Current Progress Notes/)
  assert.match(todo, /- \[x\] Review which checklist items are already partially complete/)
  assert.match(todo, /- \[x\] Mark completed work already done in the codebase/)
  assert.match(todo, /- \[x\] Break the next active module into smaller implementation tasks/)
  assert.match(todo, /- \[x\] Keep this file updated after every major feature milestone/)
  assert.match(todo, /Google OAuth sign in using Google Cloud/)
  assert.match(todo, /NEXT_PUBLIC_GOOGLE_CLIENT_ID/)
})

test("progress notes: README and final deliverables link to status document", async () => {
  const readme = await read("README.md")
  const deliverables = await read("docs", "FINAL_DELIVERABLES.md")

  assert.match(readme, /Current progress status/)
  assert.match(readme, /docs\/PROGRESS_STATUS\.md/)
  assert.match(deliverables, /Progress status/)
  assert.match(deliverables, /docs\/PROGRESS_STATUS\.md/)
})

test("progress notes: package exposes progress verification script", async () => {
  const packageJson = JSON.parse(await read("package.json"))

  assert.equal(packageJson.scripts["test:progress"], "node tests/progress.test.mjs")
})
