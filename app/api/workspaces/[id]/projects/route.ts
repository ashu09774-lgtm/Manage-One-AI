import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

type ProjectRow = RowDataPacket & {
  id: number
  name: string
  description: string | null
  color: string
  tasks: number
  completedTasks: number
  members: number
  startDate: string | null
  endDate: string | null
  progress: number
}

const allowedColors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"]

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(request)
  const { id } = await params
  const workspaceId = Number(id)

  if (!userId) {
    return badRequest("Missing user id")
  }

  if (!Number.isInteger(workspaceId) || workspaceId < 1) {
    return badRequest("Invalid workspace id")
  }

  try {
    const [projects] = await db.execute<ProjectRow[]>(
      `SELECT
        p.id,
        p.name,
        p.description,
        p.color,
        COUNT(DISTINCT t.id) AS tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS completedTasks,
        COUNT(DISTINCT t.assignee_id) AS members,
        DATE_FORMAT(MIN(t.due_date), '%Y-%m-%d') AS startDate,
        DATE_FORMAT(MAX(t.due_date), '%Y-%m-%d') AS endDate,
        COALESCE(ROUND(COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) / NULLIF(COUNT(DISTINCT t.id), 0) * 100), 0) AS progress
      FROM projects p
      INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = ?
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.workspace_id = ? AND p.archived_at IS NULL
      GROUP BY p.id, p.name, p.description, p.color, p.created_at
      ORDER BY p.created_at DESC`,
      [userId, workspaceId]
    )

    return NextResponse.json({
      projects: projects.map((project) => ({
        id: Number(project.id),
        name: String(project.name),
        description: project.description ? String(project.description) : null,
        color: String(project.color),
        tasks: Number(project.tasks ?? 0),
        completedTasks: Number(project.completedTasks ?? 0),
        members: Number(project.members ?? 0),
        startDate: project.startDate ? String(project.startDate) : null,
        endDate: project.endDate ? String(project.endDate) : null,
        progress: Number(project.progress ?? 0),
      })),
    })
  } catch (error) {
    console.error("Fetch workspace projects failed:", error)
    return serverError("Could not load projects")
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = Number(id)

  if (!Number.isInteger(workspaceId) || workspaceId < 1) {
    return badRequest("Invalid workspace id")
  }

  try {
    const { userId, name, description, color } = await request.json()
    const actorId = Number(userId)
    const projectName = String(name ?? "").trim()
    const projectDescription = String(description ?? "").trim()
    const projectColor = allowedColors.includes(color) ? color : "bg-cyan-500"

    if (!Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Missing user id")
    }

    if (!projectName) {
      return badRequest("Project name is required")
    }

    const [[membership]] = await db.execute<(RowDataPacket & { role: string })[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [workspaceId, actorId]
    )

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (membership.role === "viewer") {
      return NextResponse.json({ error: "You do not have permission to create projects" }, { status: 403 })
    }

    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO projects (workspace_id, name, description, color, created_by) VALUES (?, ?, ?, ?, ?)",
      [workspaceId, projectName, projectDescription || null, projectColor, actorId]
    )

    await db.execute(
      `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, 'created', 'project', ?, JSON_OBJECT('name', ?))`,
      [workspaceId, actorId, result.insertId, projectName]
    )

    return NextResponse.json({
      project: {
        id: result.insertId,
        name: projectName,
        description: projectDescription || null,
        color: projectColor,
        tasks: 0,
        completedTasks: 0,
        members: 0,
        startDate: null,
        endDate: null,
        progress: 0,
      },
    })
  } catch (error) {
    console.error("Create workspace project failed:", error)
    return serverError("Could not create project")
  }
}
