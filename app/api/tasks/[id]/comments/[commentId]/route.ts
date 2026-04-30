import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id, commentId } = await params
    const taskId = Number(id)
    const parsedCommentId = Number(commentId)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!Number.isInteger(taskId) || taskId < 1 || !Number.isInteger(parsedCommentId) || parsedCommentId < 1 || !Number.isInteger(userId) || userId < 1) {
      return badRequest("Invalid request")
    }

    const [rows] = await db.execute<(RowDataPacket & { workspaceId: number; ownerId: number | null; commentUserId: number | null })[]>(
      `SELECT
        t.workspace_id AS workspaceId,
        t.created_by AS ownerId,
        tc.user_id AS commentUserId
      FROM task_comments tc
      INNER JOIN tasks t ON t.id = tc.task_id
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE tc.id = ? AND tc.task_id = ?
      LIMIT 1`,
      [userId, parsedCommentId, taskId]
    )

    const comment = rows[0]
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    if (comment.commentUserId !== userId && comment.ownerId !== userId) {
      return NextResponse.json({ error: "You do not have permission to delete this comment" }, { status: 403 })
    }

    await db.execute<ResultSetHeader>("DELETE FROM task_comments WHERE id = ? AND task_id = ?", [parsedCommentId, taskId])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete task comment failed:", error)
    return serverError("Could not delete comment")
  }
}
