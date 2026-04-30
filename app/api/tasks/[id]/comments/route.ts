import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { notifyMentionedUsers } from "@/lib/mentions"
import { emitWorkspaceEvent } from "@/lib/realtime"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskId = Number(id)
    const { userId, body } = await request.json()
    const actorId = Number(userId)
    const commentBody = String(body ?? "").trim()

    if (!Number.isInteger(taskId) || taskId < 1 || !Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Invalid request")
    }

    if (!commentBody) {
      return badRequest("Comment is required")
    }

    const [taskRows] = await db.execute<(RowDataPacket & { workspaceId: number; title: string })[]>(
      `SELECT t.workspace_id AS workspaceId, t.title
      FROM tasks t
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.id = ?
      LIMIT 1`,
      [actorId, taskId]
    )

    const task = taskRows[0]
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)",
      [taskId, actorId, commentBody]
    )

    const [[user]] = await db.execute<(RowDataPacket & { name: string })[]>(
      "SELECT name FROM users WHERE id = ? LIMIT 1",
      [actorId]
    )

    await db.execute(
      `INSERT INTO activity_events (workspace_id, task_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, ?, 'commented', 'task_comment', ?, JSON_OBJECT('taskTitle', ?, 'preview', ?))`,
      [task.workspaceId, taskId, actorId, result.insertId, task.title, commentBody.slice(0, 120)]
    )

    await notifyMentionedUsers({
      workspaceId: task.workspaceId,
      actorId,
      text: commentBody,
      title: "You were mentioned in a task comment",
      body: `${user ? String(user.name) : "A teammate"} mentioned you on "${task.title}".`,
      entityType: "task_comment",
      entityId: result.insertId,
    })

    emitWorkspaceEvent(task.workspaceId, "task_comment", {
      taskId,
      commentId: result.insertId,
      userId: actorId,
      userName: user ? String(user.name) : "You",
      body: commentBody,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({
      comment: {
        id: result.insertId,
        body: commentBody,
        userId: actorId,
        userName: user ? String(user.name) : "You",
        createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      },
    })
  } catch (error) {
    console.error("Create task comment failed:", error)
    return serverError("Could not add comment")
  }
}
