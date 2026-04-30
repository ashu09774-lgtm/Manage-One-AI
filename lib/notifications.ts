import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { emitUserEvent } from "@/lib/realtime"

export type NotificationType = "task" | "deadline" | "assignment" | "automation" | "mention" | "system"

export async function createNotification(input: {
  userId: number
  type: NotificationType | string
  title: string
  body?: string | null
  entityType?: string | null
  entityId?: number | null
  dedupeHours?: number
}) {
  if (input.dedupeHours && input.entityType && input.entityId) {
    const [existing] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM notifications
      WHERE user_id = ?
        AND type = ?
        AND entity_type = ?
        AND entity_id = ?
        AND title = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      LIMIT 1`,
      [input.userId, input.type, input.entityType, input.entityId, input.title, input.dedupeHours]
    )

    if (existing.length > 0) {
      return null
    }
  }

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.type,
      input.title,
      input.body ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
    ]
  )

  const payload = {
    id: result.insertId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    createdAt: new Date().toISOString(),
    readAt: null,
  }

  emitUserEvent(input.userId, "notification", payload)
  return payload
}

export async function generateNotificationSweep(userId: number) {
  const created = []

  const [tasks] = await db.execute<RowDataPacket[]>(
    `SELECT
      t.id,
      t.title,
      t.due_date AS dueDate,
      CASE
        WHEN t.due_date < CURDATE() THEN 'overdue'
        WHEN t.due_date = CURDATE() THEN 'today'
        ELSE 'soon'
      END AS dueState
    FROM tasks t
    INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
    WHERE t.status <> 'done'
      AND (t.assignee_id = ? OR t.created_by = ?)
      AND t.due_date IS NOT NULL
      AND t.due_date <= DATE_ADD(CURDATE(), INTERVAL 2 DAY)
    ORDER BY t.due_date ASC
    LIMIT 30`,
    [userId, userId, userId]
  )

  for (const task of tasks) {
    const dueState = String(task.dueState)
    const title = dueState === "overdue"
      ? "Deadline reminder: task overdue"
      : dueState === "today"
        ? "Deadline reminder: due today"
        : "Deadline reminder: due soon"

    const notification = await createNotification({
      userId,
      type: "deadline",
      title,
      body: `${String(task.title)} needs attention.`,
      entityType: "task",
      entityId: Number(task.id),
      dedupeHours: 20,
    })
    if (notification) created.push(notification)
  }

  const [assignments] = await db.execute<RowDataPacket[]>(
    `SELECT id, title
    FROM tasks
    WHERE assignee_id = ?
      AND status <> 'done'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ORDER BY created_at DESC
    LIMIT 12`,
    [userId]
  )

  for (const task of assignments) {
    const notification = await createNotification({
      userId,
      type: "assignment",
      title: "Assignment alert",
      body: `${String(task.title)} is assigned to you.`,
      entityType: "task",
      entityId: Number(task.id),
      dedupeHours: 72,
    })
    if (notification) created.push(notification)
  }

  const [failedRuns] = await db.execute<RowDataPacket[]>(
    `SELECT ar.id, a.name
    FROM automation_runs ar
    INNER JOIN automations a ON a.id = ar.automation_id
    INNER JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ?
    WHERE ar.status = 'failed'
      AND ar.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ORDER BY ar.created_at DESC
    LIMIT 10`,
    [userId]
  )

  for (const run of failedRuns) {
    const notification = await createNotification({
      userId,
      type: "automation",
      title: "Automation alert",
      body: `${String(run.name)} failed during its latest run.`,
      entityType: "automation_run",
      entityId: Number(run.id),
      dedupeHours: 24,
    })
    if (notification) created.push(notification)
  }

  return created
}
