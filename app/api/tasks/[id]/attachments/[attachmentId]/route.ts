import { unlink } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params
    const taskId = Number(id)
    const parsedAttachmentId = Number(attachmentId)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!Number.isInteger(taskId) || taskId < 1 || !Number.isInteger(parsedAttachmentId) || parsedAttachmentId < 1 || !Number.isInteger(userId) || userId < 1) {
      return badRequest("Invalid request")
    }

    const [rows] = await db.execute<(RowDataPacket & { fileUrl: string; uploadedBy: number | null; ownerId: number | null })[]>(
      `SELECT
        ta.file_url AS fileUrl,
        ta.uploaded_by AS uploadedBy,
        t.created_by AS ownerId
      FROM task_attachments ta
      INNER JOIN tasks t ON t.id = ta.task_id
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE ta.id = ? AND ta.task_id = ?
      LIMIT 1`,
      [userId, parsedAttachmentId, taskId]
    )

    const attachment = rows[0]
    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    if (attachment.uploadedBy !== userId && attachment.ownerId !== userId) {
      return NextResponse.json({ error: "You do not have permission to delete this attachment" }, { status: 403 })
    }

    await db.execute<ResultSetHeader>("DELETE FROM task_attachments WHERE id = ? AND task_id = ?", [parsedAttachmentId, taskId])

    if (attachment.fileUrl.startsWith("/uploads/task-attachments/")) {
      const filePath = path.join(process.cwd(), "public", attachment.fileUrl.replace(/^\//, "").replace(/\//g, path.sep))
      await unlink(filePath).catch(() => undefined)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete task attachment failed:", error)
    return serverError("Could not delete attachment")
  }
}
