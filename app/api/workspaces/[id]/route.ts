import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

type WorkspaceDetailRow = RowDataPacket & {
  id: number
  name: string
  description: string | null
  color: string
  role: "owner" | "admin" | "member" | "viewer"
  tasks: number
  completedTasks: number
  members: number
  projects: number
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
    const [[workspace]] = await db.execute<WorkspaceDetailRow[]>(
      `SELECT
        w.id,
        w.name,
        w.description,
        w.color,
        wm.role,
        COUNT(DISTINCT t.id) AS tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS completedTasks,
        COUNT(DISTINCT wm2.user_id) AS members,
        COUNT(DISTINCT p.id) AS projects
      FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
      LEFT JOIN workspace_members wm2 ON wm2.workspace_id = w.id
      LEFT JOIN tasks t ON t.workspace_id = w.id
      LEFT JOIN projects p ON p.workspace_id = w.id AND p.archived_at IS NULL
      WHERE w.id = ? AND w.archived_at IS NULL
      GROUP BY w.id, w.name, w.description, w.color, wm.role
      LIMIT 1`,
      [userId, workspaceId]
    )

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    return NextResponse.json({
      workspace: {
        id: Number(workspace.id),
        name: String(workspace.name),
        description: workspace.description ? String(workspace.description) : null,
        color: String(workspace.color),
        role: workspace.role,
        tasks: Number(workspace.tasks ?? 0),
        completedTasks: Number(workspace.completedTasks ?? 0),
        members: Number(workspace.members ?? 0),
        projects: Number(workspace.projects ?? 0),
      },
    })
  } catch (error) {
    console.error("Fetch workspace detail failed:", error)
    return serverError("Could not load workspace")
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = Number(id)

  if (!Number.isInteger(workspaceId) || workspaceId < 1) {
    return badRequest("Invalid workspace id")
  }

  try {
    const { userId, name, description, color } = await request.json()
    const actorId = Number(userId)
    const workspaceName = String(name ?? "").trim()
    const workspaceDescription = String(description ?? "").trim()
    const workspaceColor = allowedColors.includes(color) ? color : "bg-blue-500"

    if (!Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Missing user id")
    }

    if (!workspaceName) {
      return badRequest("Workspace name is required")
    }

    const [[membership]] = await db.execute<(RowDataPacket & { role: string })[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [workspaceId, actorId]
    )

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (!["owner", "admin"].includes(String(membership.role))) {
      return NextResponse.json({ error: "You do not have permission to update this workspace" }, { status: 403 })
    }

    await db.execute<ResultSetHeader>(
      "UPDATE workspaces SET name = ?, description = ?, color = ? WHERE id = ?",
      [workspaceName, workspaceDescription || null, workspaceColor, workspaceId]
    )

    await db.execute(
      `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, 'updated', 'workspace', ?, JSON_OBJECT('name', ?, 'color', ?))`,
      [workspaceId, actorId, workspaceId, workspaceName, workspaceColor]
    )

    return NextResponse.json({
      workspace: {
        id: workspaceId,
        name: workspaceName,
        description: workspaceDescription || null,
        color: workspaceColor,
      },
    })
  } catch (error) {
    console.error("Update workspace failed:", error)
    return serverError("Could not save workspace settings")
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    // Check if user is owner of the workspace
    const [[membership]] = await db.execute<(RowDataPacket & { role: string })[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [workspaceId, userId]
    )

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (String(membership.role) !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can delete workspaces" }, { status: 403 })
    }

    // Get workspace name for activity log
    const [[workspace]] = await db.execute<RowDataPacket[]>(
      "SELECT name FROM workspaces WHERE id = ? LIMIT 1",
      [workspaceId]
    )

    // Delete all related data (cascade will handle most, but explicit for clarity)
    await db.execute("DELETE FROM activity_events WHERE workspace_id = ?", [workspaceId])
    await db.execute("DELETE FROM workspaces WHERE id = ?", [workspaceId])

    return NextResponse.json({ ok: true, message: "Workspace deleted successfully" })
  } catch (error) {
    console.error("Delete workspace failed:", error)
    return serverError("Could not delete workspace")
  }
}
