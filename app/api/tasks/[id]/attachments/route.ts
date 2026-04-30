import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

const uploadDir = path.join(process.cwd(), "public", "uploads", "task-attachments")
const maxFileSizeBytes = 10 * 1024 * 1024

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskId = Number(id)
    const formData = await request.formData()
    const userId = Number(formData.get("userId"))
    const file = formData.get("file")

    if (!Number.isInteger(taskId) || taskId < 1 || !Number.isInteger(userId) || userId < 1) {
      return badRequest("Invalid request")
    }

    if (!(file instanceof File)) {
      return badRequest("Attachment file is required")
    }

    if (file.size === 0) {
      return badRequest("Attachment file is empty")
    }

    if (file.size > maxFileSizeBytes) {
      return badRequest("Attachment file must be 10 MB or smaller")
    }

    const [taskRows] = await db.execute<(RowDataPacket & { workspaceId: number; title: string })[]>(
      `SELECT t.workspace_id AS workspaceId, t.title
      FROM tasks t
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.id = ?
      LIMIT 1`,
      [userId, taskId]
    )

    const task = taskRows[0]
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const extension = path.extname(file.name)
    const storedFileName = `${randomUUID()}${extension}`
    const fileUrl = `/uploads/task-attachments/${storedFileName}`
    const destination = path.join(uploadDir, storedFileName)

    await mkdir(uploadDir, { recursive: true })
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(destination, bytes)

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO task_attachments (task_id, uploaded_by, file_name, file_url, file_size_bytes, mime_type)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [taskId, userId, file.name, fileUrl, file.size, file.type || null]
    )

    const [[user]] = await db.execute<(RowDataPacket & { name: string })[]>(
      "SELECT name FROM users WHERE id = ? LIMIT 1",
      [userId]
    )

    await db.execute(
      `INSERT INTO activity_events (workspace_id, task_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, ?, 'attached', 'task_attachment', ?, JSON_OBJECT('taskTitle', ?, 'fileName', ?))`,
      [task.workspaceId, taskId, userId, result.insertId, task.title, file.name]
    )

    return NextResponse.json({
      attachment: {
        id: result.insertId,
        fileName: file.name,
        fileUrl,
        fileSizeBytes: file.size,
        mimeType: file.type || null,
        uploadedBy: userId,
        uploadedByName: user ? String(user.name) : "You",
        createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      },
    })
  } catch (error) {
    console.error("Create task attachment failed:", error)
    return serverError("Could not upload attachment")
  }
}
