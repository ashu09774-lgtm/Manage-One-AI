import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

type SearchItem = {
  id: number
  type: "task" | "project" | "workspace" | "note"
  title: string
  description: string | null
  workspaceId: number | null
  workspaceName: string | null
  href: string
  meta: Record<string, string | number | null>
  score: number
}

export async function GET(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const query = String(searchParams.get("q") ?? "").trim()
  const type = String(searchParams.get("type") ?? "all")
  const status = String(searchParams.get("status") ?? "all")
  const priority = String(searchParams.get("priority") ?? "all")
  const workspaceId = Number(searchParams.get("workspaceId"))
  const smart = String(searchParams.get("smart") ?? "all")

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const results: SearchItem[] = []

    if (type === "all" || type === "task") {
      results.push(...await searchTasks({ userId, query, status, priority, workspaceId, smart }))
    }
    if (type === "all" || type === "workspace") {
      results.push(...await searchWorkspaces({ userId, query, workspaceId }))
    }
    if (type === "all" || type === "project") {
      results.push(...await searchProjects({ userId, query, workspaceId }))
    }
    if (type === "all" || type === "note") {
      results.push(...await searchNotes({ userId, query, workspaceId, smart }))
    }

    const sorted = results
      .map((item) => ({ ...item, score: scoreItem(item, query) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 80)

    const [workspaceRows] = await db.execute<RowDataPacket[]>(
      `SELECT w.id, w.name
      FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
      WHERE w.archived_at IS NULL
      ORDER BY w.name`,
      [userId]
    )

    return NextResponse.json({
      query,
      results: sorted,
      counts: {
        all: sorted.length,
        tasks: sorted.filter((item) => item.type === "task").length,
        projects: sorted.filter((item) => item.type === "project").length,
        workspaces: sorted.filter((item) => item.type === "workspace").length,
        notes: sorted.filter((item) => item.type === "note").length,
      },
      workspaces: workspaceRows.map((workspace) => ({
        id: Number(workspace.id),
        name: String(workspace.name),
      })),
      smartFilters: buildSmartFilters(sorted),
      semanticSummary: buildSemanticSummary(sorted, query),
    })
  } catch (error) {
    console.error("Global search failed:", error)
    return serverError("Could not search workspace data")
  }
}

async function searchTasks(input: { userId: number; query: string; status: string; priority: string; workspaceId: number; smart: string }) {
  const filters = ["1 = 1"]
  const params: Array<string | number> = [input.userId]

  if (input.query) {
    filters.push("(t.title LIKE ? OR t.description LIKE ? OR w.name LIKE ? OR p.name LIKE ? OR l.name LIKE ?)")
    params.push(...likeParams(input.query, 5))
  }
  if (["todo", "in-progress", "review", "done"].includes(input.status)) {
    filters.push("t.status = ?")
    params.push(input.status)
  }
  if (["low", "medium", "high", "urgent"].includes(input.priority)) {
    filters.push("t.priority = ?")
    params.push(input.priority)
  }
  if (Number.isInteger(input.workspaceId) && input.workspaceId > 0) {
    filters.push("t.workspace_id = ?")
    params.push(input.workspaceId)
  }
  if (input.smart === "overdue") filters.push("t.status <> 'done' AND t.due_date < CURDATE()")
  if (input.smart === "due_soon") filters.push("t.status <> 'done' AND t.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)")
  if (input.smart === "assigned_to_me") filters.push("t.assignee_id = ?")
  if (input.smart === "assigned_to_me") params.push(input.userId)
  if (input.smart === "high_priority") filters.push("t.priority IN ('high', 'urgent')")

  const [tasks] = await db.execute<RowDataPacket[]>(
    `SELECT
      t.id,
      t.workspace_id AS workspaceId,
      w.name AS workspaceName,
      p.name AS projectName,
      t.title,
      t.description,
      t.status,
      t.priority,
      u.name AS assignee,
      DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate,
      GROUP_CONCAT(DISTINCT l.name ORDER BY l.name SEPARATOR ', ') AS labels
    FROM tasks t
    INNER JOIN workspaces w ON w.id = t.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN task_labels tl ON tl.task_id = t.id
    LEFT JOIN labels l ON l.id = tl.label_id
    WHERE ${filters.join(" AND ")}
    GROUP BY t.id, t.workspace_id, w.name, p.name, t.title, t.description, t.status, t.priority, u.name, t.due_date, t.updated_at
    ORDER BY t.updated_at DESC
    LIMIT 40`,
    params
  )

  return tasks.map((task) => ({
    id: Number(task.id),
    type: "task" as const,
    title: String(task.title),
    description: task.description ? String(task.description) : null,
    workspaceId: Number(task.workspaceId),
    workspaceName: String(task.workspaceName),
    href: "/dashboard/tasks",
    meta: {
      status: String(task.status),
      priority: String(task.priority),
      assignee: task.assignee ? String(task.assignee) : null,
      dueDate: task.dueDate ? String(task.dueDate) : null,
      project: task.projectName ? String(task.projectName) : null,
      labels: task.labels ? String(task.labels) : null,
    },
    score: 0,
  }))
}

async function searchWorkspaces(input: { userId: number; query: string; workspaceId: number }) {
  const filters = ["w.archived_at IS NULL"]
  const params: Array<string | number> = [input.userId]

  if (input.query) {
    filters.push("(w.name LIKE ? OR w.description LIKE ?)")
    params.push(...likeParams(input.query, 2))
  }
  if (Number.isInteger(input.workspaceId) && input.workspaceId > 0) {
    filters.push("w.id = ?")
    params.push(input.workspaceId)
  }

  const [workspaces] = await db.execute<RowDataPacket[]>(
    `SELECT
      w.id,
      w.name,
      w.description,
      COUNT(DISTINCT t.id) AS tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS completedTasks
    FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
    LEFT JOIN tasks t ON t.workspace_id = w.id
    WHERE ${filters.join(" AND ")}
    GROUP BY w.id, w.name, w.description, w.updated_at
    ORDER BY w.updated_at DESC
    LIMIT 25`,
    params
  )

  return workspaces.map((workspace) => ({
    id: Number(workspace.id),
    type: "workspace" as const,
    title: String(workspace.name),
    description: workspace.description ? String(workspace.description) : null,
    workspaceId: Number(workspace.id),
    workspaceName: String(workspace.name),
    href: `/dashboard/workspaces/${workspace.id}`,
    meta: {
      tasks: Number(workspace.tasks ?? 0),
      completedTasks: Number(workspace.completedTasks ?? 0),
    },
    score: 0,
  }))
}

async function searchProjects(input: { userId: number; query: string; workspaceId: number }) {
  const filters = ["p.archived_at IS NULL"]
  const params: Array<string | number> = [input.userId]

  if (input.query) {
    filters.push("(p.name LIKE ? OR p.description LIKE ? OR w.name LIKE ?)")
    params.push(...likeParams(input.query, 3))
  }
  if (Number.isInteger(input.workspaceId) && input.workspaceId > 0) {
    filters.push("p.workspace_id = ?")
    params.push(input.workspaceId)
  }

  const [projects] = await db.execute<RowDataPacket[]>(
    `SELECT
      p.id,
      p.workspace_id AS workspaceId,
      w.name AS workspaceName,
      p.name,
      p.description,
      COUNT(DISTINCT t.id) AS tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS completedTasks
    FROM projects p
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = ?
    LEFT JOIN tasks t ON t.project_id = p.id
    WHERE ${filters.join(" AND ")}
    GROUP BY p.id, p.workspace_id, w.name, p.name, p.description, p.updated_at
    ORDER BY p.updated_at DESC
    LIMIT 30`,
    params
  )

  return projects.map((project) => ({
    id: Number(project.id),
    type: "project" as const,
    title: String(project.name),
    description: project.description ? String(project.description) : null,
    workspaceId: Number(project.workspaceId),
    workspaceName: String(project.workspaceName),
    href: `/dashboard/workspaces/${project.workspaceId}`,
    meta: {
      tasks: Number(project.tasks ?? 0),
      completedTasks: Number(project.completedTasks ?? 0),
    },
    score: 0,
  }))
}

async function searchNotes(input: { userId: number; query: string; workspaceId: number; smart: string }) {
  const filters = ["1 = 1"]
  const params: Array<string | number> = [input.userId]

  if (input.query) {
    filters.push("(n.title LIKE ? OR n.content LIKE ? OR w.name LIKE ? OR p.name LIKE ?)")
    params.push(...likeParams(input.query, 4))
  }
  if (Number.isInteger(input.workspaceId) && input.workspaceId > 0) {
    filters.push("n.workspace_id = ?")
    params.push(input.workspaceId)
  }
  if (input.smart === "docs") filters.push("n.doc_type = 'documentation'")

  const [notes] = await db.execute<RowDataPacket[]>(
    `SELECT
      n.id,
      n.workspace_id AS workspaceId,
      w.name AS workspaceName,
      p.name AS projectName,
      n.title,
      n.content,
      n.doc_type AS docType,
      DATE_FORMAT(n.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
    FROM notes n
    INNER JOIN workspaces w ON w.id = n.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = n.workspace_id AND wm.user_id = ?
    LEFT JOIN projects p ON p.id = n.project_id
    WHERE ${filters.join(" AND ")}
    ORDER BY n.updated_at DESC
    LIMIT 35`,
    params
  )

  return notes.map((note) => ({
    id: Number(note.id),
    type: "note" as const,
    title: String(note.title),
    description: note.content ? String(note.content).slice(0, 220) : null,
    workspaceId: Number(note.workspaceId),
    workspaceName: String(note.workspaceName),
    href: "/dashboard/notes",
    meta: {
      docType: String(note.docType),
      project: note.projectName ? String(note.projectName) : null,
      updatedAt: String(note.updatedAt),
    },
    score: 0,
  }))
}

function likeParams(query: string, count: number) {
  return Array.from({ length: count }, () => `%${query}%`)
}

function scoreItem(item: SearchItem, query: string) {
  if (!query) return item.type === "task" ? 12 : 10

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  const title = item.title.toLowerCase()
  const description = (item.description ?? "").toLowerCase()
  const meta = Object.values(item.meta).join(" ").toLowerCase()
  let score = 0

  for (const token of tokens) {
    if (title === token) score += 50
    if (title.includes(token)) score += 25
    if (description.includes(token)) score += 10
    if (meta.includes(token)) score += 8
  }

  if (item.type === "task" && item.meta.priority === "urgent") score += 5
  if (item.type === "note" && item.meta.docType === "documentation") score += 3
  return score
}

function buildSmartFilters(results: SearchItem[]) {
  return [
    { id: "overdue", label: "Overdue tasks", count: results.filter((item) => item.type === "task" && item.meta.dueDate && item.meta.status !== "done" && String(item.meta.dueDate) < new Date().toISOString().slice(0, 10)).length },
    { id: "due_soon", label: "Due soon", count: results.filter((item) => item.type === "task" && item.meta.dueDate && item.meta.status !== "done").length },
    { id: "high_priority", label: "High priority", count: results.filter((item) => item.type === "task" && ["high", "urgent"].includes(String(item.meta.priority))).length },
    { id: "docs", label: "Documentation", count: results.filter((item) => item.type === "note" && item.meta.docType === "documentation").length },
    { id: "assigned_to_me", label: "Assigned to me", count: results.filter((item) => item.type === "task").length },
  ]
}

function buildSemanticSummary(results: SearchItem[], query: string) {
  if (!query) {
    return "Search across tasks, projects, workspaces, and notes. Use smart filters to narrow intent."
  }

  const topTypes = ["task", "project", "workspace", "note"]
    .map((type) => ({ type, count: results.filter((item) => item.type === type).length }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)

  if (topTypes.length === 0) {
    return `No semantic matches found for "${query}". Try a broader keyword or remove filters.`
  }

  return `Best matches for "${query}" are concentrated in ${topTypes.slice(0, 2).map((item) => `${item.count} ${item.type}${item.count === 1 ? "" : "s"}`).join(" and ")}.`
}
