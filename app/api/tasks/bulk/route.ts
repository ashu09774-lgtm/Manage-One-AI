import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { badRequest, serverError } from "@/lib/api-utils"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export async function PATCH(request: Request) {
  try {
    const { userId, taskIds, action, value } = await request.json()
    const actorId = Number(userId)

    if (!Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Invalid user id")
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return badRequest("No tasks specified")
    }

    if (!action || !["status", "priority", "delete"].includes(action)) {
      return badRequest("Invalid action")
    }

    const safeTaskIds = taskIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    if (safeTaskIds.length === 0) {
      return badRequest("No valid task ids provided")
    }

    // Verify user has access to all tasks
    const placeholders = safeTaskIds.map(() => "?").join(",")
    const [accessible] = await db.execute<RowDataPacket[]>(
      `SELECT DISTINCT t.id
       FROM tasks t
       INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
       WHERE t.id IN (${placeholders})`,
      [actorId, ...safeTaskIds]
    )

    const accessibleIds = accessible.map((row) => Number(row.id))
    if (accessibleIds.length === 0) {
      return badRequest("No accessible tasks found")
    }

    const accessPlaceholders = accessibleIds.map(() => "?").join(",")

    if (action === "delete") {
      await db.execute(
        `DELETE FROM tasks WHERE id IN (${accessPlaceholders})`,
        accessibleIds
      )
      return NextResponse.json({ ok: true, deleted: accessibleIds.length })
    }

    if (action === "status") {
      const validStatuses = ["todo", "in-progress", "review", "done"]
      if (!validStatuses.includes(value)) {
        return badRequest("Invalid status value")
      }
      await db.execute(
        `UPDATE tasks 
         SET status = ?, 
             completed_at = CASE WHEN ? = 'done' THEN CURRENT_TIMESTAMP ELSE NULL END
         WHERE id IN (${accessPlaceholders})`,
        [value, value, ...accessibleIds]
      )
      return NextResponse.json({ ok: true, updated: accessibleIds.length, status: value })
    }

    if (action === "priority") {
      const validPriorities = ["low", "medium", "high", "urgent"]
      if (!validPriorities.includes(value)) {
        return badRequest("Invalid priority value")
      }
      await db.execute(
        `UPDATE tasks SET priority = ? WHERE id IN (${accessPlaceholders})`,
        [value, ...accessibleIds]
      )
      return NextResponse.json({ ok: true, updated: accessibleIds.length, priority: value })
    }

    return badRequest("Unknown action")
  } catch (error) {
    console.error("Bulk action failed:", error)
    return serverError("Could not process bulk action")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, workspaceId, tasks } = await request.json()
    const actorId = Number(userId)
    const parsedWorkspaceId = Number(workspaceId)

    if (!Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Invalid user id")
    }

    if (!Number.isInteger(parsedWorkspaceId) || parsedWorkspaceId < 1) {
      return badRequest("Invalid workspace id")
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return badRequest("No tasks provided")
    }

    // Verify user is member of workspace
    const [membership] = await db.execute<RowDataPacket[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [parsedWorkspaceId, actorId]
    )

    if (!membership[0]) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Create tasks
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      
      const createdIds = []
      for (const task of tasks) {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO tasks (workspace_id, title, description, priority, status)
           VALUES (?, ?, ?, ?, ?)`,
          [
            parsedWorkspaceId,
            String(task.title || "Untitled Task").slice(0, 255),
            String(task.description || ""),
            String(task.priority || "medium"),
            String(task.status || "todo")
          ]
        )
        createdIds.push(result.insertId)
      }

      await connection.commit()
      return NextResponse.json({ ok: true, count: createdIds.length, ids: createdIds })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Bulk create failed:", error)
    return serverError("Could not create tasks in bulk")
  }
}
