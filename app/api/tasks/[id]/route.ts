import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"

type TaskCommentRow = RowDataPacket & {
  id: number
  body: string
  userId: number | null
  userName: string | null
  createdAt: string
}

type TaskAttachmentRow = RowDataPacket & {
  id: number
  fileName: string
  fileUrl: string
  fileSizeBytes: number | null
  mimeType: string | null
  uploadedBy: number | null
  uploadedByName: string | null
  createdAt: string
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskId = Number(id)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!taskId || !userId) {
      return badRequest("Missing task or user id")
    }

    const [[task]] = await db.execute<RowDataPacket[]>(
      `SELECT
        t.id,
        t.workspace_id AS workspaceId,
        w.name AS workspace,
        t.project_id AS projectId,
        p.name AS project,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assignee_id AS assigneeId,
        DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate
      FROM tasks t
      INNER JOIN workspaces w ON w.id = t.workspace_id
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = ?
      LIMIT 1`,
      [userId, taskId]
    )

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const [labels] = await db.execute<RowDataPacket[]>(
      `SELECT l.id, l.name, l.color
      FROM task_labels tl
      INNER JOIN labels l ON l.id = tl.label_id
      WHERE tl.task_id = ?
      ORDER BY l.name`,
      [taskId]
    )

    const [subtasks] = await db.execute<RowDataPacket[]>(
      `SELECT id, title, completed, sort_order AS sortOrder
      FROM task_subtasks
      WHERE task_id = ?
      ORDER BY sort_order, id`,
      [taskId]
    )

    const [comments] = await db.execute<TaskCommentRow[]>(
      `SELECT
        tc.id,
        tc.body,
        tc.user_id AS userId,
        u.name AS userName,
        DATE_FORMAT(tc.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM task_comments tc
      LEFT JOIN users u ON u.id = tc.user_id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at ASC, tc.id ASC`,
      [taskId]
    )

    const [attachments] = await db.execute<TaskAttachmentRow[]>(
      `SELECT
        ta.id,
        ta.file_name AS fileName,
        ta.file_url AS fileUrl,
        ta.file_size_bytes AS fileSizeBytes,
        ta.mime_type AS mimeType,
        ta.uploaded_by AS uploadedBy,
        u.name AS uploadedByName,
        DATE_FORMAT(ta.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM task_attachments ta
      LEFT JOIN users u ON u.id = ta.uploaded_by
      WHERE ta.task_id = ?
      ORDER BY ta.created_at DESC, ta.id DESC`,
      [taskId]
    )

    return NextResponse.json({
      task: {
        ...task,
        labels: labels.map((label) => ({
          id: Number(label.id),
          name: String(label.name),
          color: String(label.color),
        })),
        subtasks: subtasks.map((subtask) => ({
          id: Number(subtask.id),
          title: String(subtask.title),
          completed: Boolean(subtask.completed),
          sortOrder: Number(subtask.sortOrder ?? 0),
        })),
        comments: comments.map((comment) => ({
          id: Number(comment.id),
          body: String(comment.body),
          userId: comment.userId ? Number(comment.userId) : null,
          userName: comment.userName ? String(comment.userName) : null,
          createdAt: String(comment.createdAt),
        })),
        attachments: attachments.map((attachment) => ({
          id: Number(attachment.id),
          fileName: String(attachment.fileName),
          fileUrl: String(attachment.fileUrl),
          fileSizeBytes: attachment.fileSizeBytes === null ? null : Number(attachment.fileSizeBytes),
          mimeType: attachment.mimeType ? String(attachment.mimeType) : null,
          uploadedBy: attachment.uploadedBy ? Number(attachment.uploadedBy) : null,
          uploadedByName: attachment.uploadedByName ? String(attachment.uploadedByName) : null,
          createdAt: String(attachment.createdAt),
        })),
      },
    })
  } catch (error) {
    console.error("Fetch task failed:", error)
    return serverError("Could not load task details")
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskId = Number(id)
    const { userId, status, completed, title, description, priority, dueDate, labelIds, subtasks, projectId, assigneeId, sortOrder } = await request.json()
    const actorId = Number(userId)

    if (!Number.isInteger(taskId) || taskId < 1 || !Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Invalid request")
    }

    const [taskRows] = await db.execute<
      (RowDataPacket & { workspaceId: number; projectId: number | null; assigneeId: number | null; title: string; description: string | null; status: string; priority: string; dueDate: string | null })[]
    >(
      `SELECT
      t.workspace_id AS workspaceId,
      t.project_id AS projectId,
      t.assignee_id AS assigneeId,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.sort_order AS sortOrder,
      DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate
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

    const nextStatus = typeof completed === "boolean" ? (completed ? "done" : "todo") : status ?? task.status
    if (!["todo", "in-progress", "review", "done"].includes(nextStatus)) {
      return badRequest("Invalid task status")
    }

    const nextPriority = ["low", "medium", "high", "urgent"].includes(priority) ? priority : task.priority
    const nextTitle = String(title ?? task.title).trim() || task.title
    const nextDescription = description === undefined ? task.description : String(description ?? "").trim() || null
    const nextDueDate = dueDate === undefined ? task.dueDate : String(dueDate || "") || null
    const nextProjectId = projectId === undefined ? task.projectId : (Number.isInteger(Number(projectId)) && Number(projectId) > 0 ? Number(projectId) : null)
    const nextAssigneeId = assigneeId === undefined ? task.assigneeId : (Number.isInteger(Number(assigneeId)) && Number(assigneeId) > 0 ? Number(assigneeId) : null)

    const nextSortOrder = sortOrder === undefined ? (task.sortOrder ?? 0) : Number(sortOrder)

    if (nextProjectId) {
      const [projectRows] = await db.execute<RowDataPacket[]>(
        "SELECT id FROM projects WHERE id = ? AND workspace_id = ? AND archived_at IS NULL LIMIT 1",
        [nextProjectId, task.workspaceId]
      )

      if (projectRows.length === 0) {
        return badRequest("Invalid project")
      }
    }

    if (nextAssigneeId) {
      const [assigneeRows] = await db.execute<RowDataPacket[]>(
        "SELECT user_id FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
        [task.workspaceId, nextAssigneeId]
      )

      if (assigneeRows.length === 0) {
        return badRequest("Invalid assignee")
      }
    }

    await db.execute(
      `UPDATE tasks
      SET project_id = ?, assignee_id = ?, title = ?, description = ?, status = ?, priority = ?, due_date = ?, sort_order = ?, completed_at = CASE WHEN ? = 'done' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = ?`,
      [nextProjectId, nextAssigneeId, nextTitle, nextDescription, nextStatus, nextPriority, nextDueDate, nextSortOrder, nextStatus, taskId]
    )

    if (Array.isArray(labelIds)) {
      const parsedLabelIds = labelIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
      await db.execute("DELETE FROM task_labels WHERE task_id = ?", [taskId])
      for (const labelId of parsedLabelIds) {
        await db.execute("INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)", [taskId, labelId])
      }
    }

    if (Array.isArray(subtasks)) {
      const safeSubtasks = subtasks.map((item: { id?: number; title?: string; completed?: boolean }, index: number) => ({
        id: Number(item.id ?? 0),
        title: String(item.title ?? "").trim(),
        completed: item.completed === true,
        sortOrder: index,
      })).filter((item) => item.title)

      const existingIds = safeSubtasks.map((item) => item.id).filter((item) => item > 0)
      if (existingIds.length > 0) {
        await db.execute(
          `DELETE FROM task_subtasks
          WHERE task_id = ? AND id NOT IN (${existingIds.map(() => "?").join(",")})`,
          [taskId, ...existingIds]
        )
      } else {
        await db.execute("DELETE FROM task_subtasks WHERE task_id = ?", [taskId])
      }

      for (const subtask of safeSubtasks) {
        if (subtask.id > 0) {
          await db.execute(
            "UPDATE task_subtasks SET title = ?, completed = ?, sort_order = ? WHERE id = ? AND task_id = ?",
            [subtask.title, subtask.completed, subtask.sortOrder, subtask.id, taskId]
          )
        } else {
          await db.execute(
            "INSERT INTO task_subtasks (task_id, title, completed, sort_order) VALUES (?, ?, ?, ?)",
            [taskId, subtask.title, subtask.completed, subtask.sortOrder]
          )
        }
      }
    }

    await createNotification({
      userId: actorId,
      type: "task",
      title: "Task updated",
      body: `${nextTitle} moved to ${nextStatus}.`,
      entityType: "task",
      entityId: taskId,
    })
    if (nextAssigneeId && nextAssigneeId !== task.assigneeId) {
      await createNotification({
        userId: nextAssigneeId,
        type: "assignment",
        title: "Task assigned to you",
        body: `${nextTitle} is now assigned to you.`,
        entityType: "task",
        entityId: taskId,
        dedupeHours: 24,
      })
    }
    await db.execute(
      `INSERT INTO activity_events (workspace_id, task_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, ?, 'updated', 'task', ?, JSON_OBJECT('status', ?, 'priority', ?))`,
      [task.workspaceId, taskId, actorId, taskId, nextStatus, nextPriority]
    )

    return NextResponse.json({ task: { id: taskId, status: nextStatus } })
  } catch (error) {
    console.error("Update task failed:", error)
    return serverError("Could not update task")
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskId = Number(id)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!taskId || !userId) {
      return badRequest("Missing task or user id")
    }

    const [taskRows] = await db.execute<
      (RowDataPacket & { workspaceId: number; title: string })[]
    >(
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

    await db.execute<ResultSetHeader>("DELETE FROM tasks WHERE id = ?", [taskId])
    await createNotification({
      userId,
      type: "task",
      title: "Task deleted",
      body: `${task.title} was deleted.`,
      entityType: "task",
      entityId: taskId,
    })
    await db.execute(
      `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, 'deleted', 'task', ?, JSON_OBJECT('title', ?))`,
      [task.workspaceId, userId, taskId, task.title]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete task failed:", error)
    return serverError("Could not delete task")
  }
}
