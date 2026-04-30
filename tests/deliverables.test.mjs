import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const file = (...parts) => path.join(root, ...parts)
const exists = (...parts) => existsSync(file(...parts))
const read = (...parts) => readFile(file(...parts), "utf8")

test("final deliverables: report, demo, architecture, UML, and deployment artifacts exist", async () => {
  const requiredFiles = [
    ["docs", "ARCHITECTURE.md"],
    ["docs", "UML.md"],
    ["docs", "IMPLEMENTATION_RESULTS.md"],
    ["docs", "REPORT_SCREENSHOTS.md"],
    ["docs", "DEMO_PRESENTATION.md"],
    ["docs", "DEPLOYMENT.md"],
    ["docs", "FINAL_DELIVERABLES.md"],
    ["docs", "PRODUCT_GOALS.md"],
    ["docs", "BUILD_ORDER.md"],
    ["docs", "TESTING.md"],
    [".github", "ISSUE_TEMPLATE", "bug_report.md"],
    [".github", "ISSUE_TEMPLATE", "feature_request.md"],
    [".github", "pull_request_template.md"],
  ]

  for (const requiredFile of requiredFiles) {
    assert.equal(exists(...requiredFile), true, `${requiredFile.join("/")} should exist`)
  }
})

test("final deliverables: diagrams and presentation contain report-ready sections", async () => {
  const architecture = await read("docs", "ARCHITECTURE.md")
  const uml = await read("docs", "UML.md")
  const presentation = await read("docs", "DEMO_PRESENTATION.md")
  const deployment = await read("docs", "DEPLOYMENT.md")

  assert.match(architecture, /```mermaid/)
  assert.match(architecture, /High-Level Architecture/)
  assert.match(uml, /classDiagram/)
  assert.match(uml, /sequenceDiagram/)
  assert.match(presentation, /Slide 1/)
  assert.match(presentation, /Live Demo Path/)
  assert.match(deployment, /Release Checklist/)
})

test("final deliverables: README and index point to deliverable artifacts", async () => {
  const readme = await read("README.md")
  const index = await read("docs", "FINAL_DELIVERABLES.md")

  for (const label of [
    "System architecture",
    "UML diagrams",
    "Implementation results",
    "Demo presentation",
    "Deployment package",
    "Recommended build order",
  ]) {
    assert.match(index, new RegExp(label, "i"))
  }

  assert.match(readme, /Final Deliverables/)
  assert.match(readme, /docs\/FINAL_DELIVERABLES\.md/)
})
