import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
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

  const [[preferences]] = await db.execute<RowDataPacket[]>(
    `SELECT
      COALESCE(email_notifications, TRUE) AS emailNotifications,
      COALESCE(push_notifications, TRUE) AS pushNotifications
    FROM user_settings
    WHERE user_id = ?
    LIMIT 1`,
    [input.userId]
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

  if (!preferences || Boolean(preferences.pushNotifications)) {
    emitUserEvent(input.userId, "notification", payload)
  }

  if ((!preferences || Boolean(preferences.emailNotifications)) && input.title === "AI goal completed") {
    void sendCompletionEmail(input.userId, input.body ?? input.title)
  }

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

  const aiGoalNotifications = await generateAiGoalCompletionSweep(userId)
  created.push(...aiGoalNotifications)

  return created
}

export async function generateAiGoalCompletionSweep(userId: number) {
  const created = []
  const [goals] = await db.execute<RowDataPacket[]>(
    `SELECT
      ar.id,
      ar.goal,
      COUNT(t.id) AS total,
      COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed
    FROM ai_agent_runs ar
    INNER JOIN tasks t ON t.ai_agent_run_id = ar.id AND t.ai_generated = TRUE
    WHERE ar.user_id = ?
    GROUP BY ar.id, ar.goal
    HAVING total > 0 AND total = completed
    LIMIT 20`,
    [userId]
  )

  for (const goal of goals) {
    const notification = await createNotification({
      userId,
      type: "automation",
      title: "AI goal completed",
      body: `All ${Number(goal.total)} tasks are done for: ${String(goal.goal)}`,
      entityType: "ai_agent_run",
      entityId: Number(goal.id),
      dedupeHours: 720,
    })
    if (notification) created.push(notification)
  }

  return created
}

async function sendCompletionEmail(userId: number, body: string) {
  try {
    const [[user]] = await db.execute<RowDataPacket[]>(
      "SELECT email FROM users WHERE id = ? LIMIT 1",
      [userId]
    )
    if (!user?.email) return

    await sendEmail({
      to: String(user.email),
      subject: "Manage One AI - AI goal completed",
      text: body,
      html: `<p>${body}</p>`,
    })
  } catch (error) {
    console.error("AI completion email failed:", error)
  }
}
