import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { badRequest, serverError } from "@/lib/api-utils"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; depId: string }> }) {
  try {
    const { id, depId } = await params
    const taskId = Number(id)
    const dependsOnTaskId = Number(depId)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!taskId || !userId || !dependsOnTaskId) {
      return badRequest("Missing required parameters")
    }

    // Verify access
    const [taskRows] = await db.execute<RowDataPacket[]>(
      `SELECT t.workspace_id
      FROM tasks t
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.id = ?
      LIMIT 1`,
      [userId, taskId]
    )

    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    await db.execute<ResultSetHeader>(
      "DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?",
      [taskId, dependsOnTaskId]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete dependency failed:", error)
    return serverError("Could not delete dependency")
  }
}
