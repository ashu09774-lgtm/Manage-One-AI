import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { badRequest, serverError } from "@/lib/api-utils"
import type { RowDataPacket } from "mysql2"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskId = Number(id)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!taskId || !userId) {
      return badRequest("Missing task or user id")
    }

    // Verify access
    const [taskRows] = await db.execute<RowDataPacket[]>(
      `SELECT t.workspace_id AS workspaceId
      FROM tasks t
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.id = ?
      LIMIT 1`,
      [userId, taskId]
    )

    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const [dependencies] = await db.execute<RowDataPacket[]>(
      `SELECT
        d.depends_on_task_id AS id,
        t.title,
        t.status,
        t.priority
      FROM task_dependencies d
      INNER JOIN tasks t ON t.id = d.depends_on_task_id
      WHERE d.task_id = ?
      ORDER BY d.created_at DESC`,
      [taskId]
    )

    return NextResponse.json({ dependencies })
  } catch (error) {
    console.error("Fetch dependencies failed:", error)
    return serverError("Could not load dependencies")
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskId = Number(id)
    const { userId, dependsOnTaskId } = await request.json()

    if (!taskId || !userId || !dependsOnTaskId) {
      return badRequest("Missing required fields")
    }

    if (taskId === dependsOnTaskId) {
      return badRequest("Task cannot depend on itself")
    }

    // Verify access and same workspace
    const [taskRows] = await db.execute<RowDataPacket[]>(
      `SELECT t1.workspace_id
      FROM tasks t1
      INNER JOIN tasks t2 ON t1.workspace_id = t2.workspace_id
      INNER JOIN workspace_members wm ON wm.workspace_id = t1.workspace_id AND wm.user_id = ?
      WHERE t1.id = ? AND t2.id = ?
      LIMIT 1`,
      [userId, taskId, dependsOnTaskId]
    )

    if (taskRows.length === 0) {
      return badRequest("Invalid task or dependency task")
    }

    // Check for circular dependency (simple 1-level check)
    const [circularRows] = await db.execute<RowDataPacket[]>(
      "SELECT task_id FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?",
      [dependsOnTaskId, taskId]
    )

    if (circularRows.length > 0) {
      return badRequest("Circular dependency detected")
    }

    await db.execute(
      "INSERT IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)",
      [taskId, dependsOnTaskId]
    )

    const [dependencyDetails] = await db.execute<RowDataPacket[]>(
      `SELECT id, title, status, priority FROM tasks WHERE id = ? LIMIT 1`,
      [dependsOnTaskId]
    )

    return NextResponse.json({ dependency: dependencyDetails[0] })
  } catch (error) {
    console.error("Add dependency failed:", error)
    return serverError("Could not add dependency")
  }
}
