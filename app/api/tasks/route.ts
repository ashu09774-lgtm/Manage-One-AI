import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"

type TaskRow = RowDataPacket & {
  id: number
  workspaceId: number
  workspace: string
  projectId: number | null
  project: string | null
  title: string
  description: string | null
  status: "todo" | "in-progress" | "review" | "done"
  priority: "low" | "medium" | "high" | "urgent"
  assignee: string | null
  assigneeId: number | null
  dueDate: string | null
  comments: number
  attachments: number
}

export async function GET(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const workspaceId = Number(searchParams.get("workspaceId"))

  if (!userId) {
    return badRequest("Missing user id")
  }

  const params: Array<string | number> = [userId]
  let workspaceFilter = ""

  if (Number.isInteger(workspaceId) && workspaceId > 0) {
    workspaceFilter = "AND t.workspace_id = ?"
    params.push(workspaceId)
  }

  try {
    const [tasks] = await db.execute<TaskRow[]>(
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
        u.name AS assignee,
        t.assignee_id AS assigneeId,
        DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate,
        COUNT(DISTINCT tc.id) AS comments,
        COUNT(DISTINCT ta.id) AS attachments
      FROM tasks t
      INNER JOIN workspaces w ON w.id = t.workspace_id
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN task_comments tc ON tc.task_id = t.id
      LEFT JOIN task_attachments ta ON ta.task_id = t.id
      WHERE 1 = 1 ${workspaceFilter}
      GROUP BY t.id, t.workspace_id, w.name, t.project_id, p.name, t.title, t.description, t.status, t.priority, u.name, t.assignee_id, t.due_date, t.updated_at
      ORDER BY t.updated_at DESC`,
      params
    )

    const taskIds = tasks.map((task) => task.id)
    const labelsByTask = new Map<number, Array<{ id: number; name: string; color: string }>>()
    const subtasksByTask = new Map<number, { total: number; completed: number }>()

    if (taskIds.length > 0) {
      const placeholders = taskIds.map(() => "?").join(",")
      const [labels] = await db.execute<RowDataPacket[]>(
        `SELECT tl.task_id AS taskId, l.id, l.name, l.color
        FROM task_labels tl
        INNER JOIN labels l ON l.id = tl.label_id
        WHERE tl.task_id IN (${placeholders})
        ORDER BY l.name`,
        taskIds
      )

      for (const label of labels) {
        labelsByTask.set(Number(label.taskId), [...(labelsByTask.get(Number(label.taskId)) ?? []), {
          id: Number(label.id),
          name: String(label.name),
          color: String(label.color),
        }])
      }

      const [subtasks] = await db.execute<RowDataPacket[]>(
        `SELECT
          task_id AS taskId,
          COUNT(*) AS total,
          COUNT(CASE WHEN completed = TRUE THEN 1 END) AS completed
        FROM task_subtasks
        WHERE task_id IN (${placeholders})
        GROUP BY task_id`,
        taskIds
      )

      for (const subtask of subtasks) {
        subtasksByTask.set(Number(subtask.taskId), {
          total: Number(subtask.total ?? 0),
          completed: Number(subtask.completed ?? 0),
        })
      }
    }

    return NextResponse.json({
      tasks: tasks.map((task) => ({
        id: Number(task.id),
        workspaceId: Number(task.workspaceId),
        workspace: String(task.workspace),
        projectId: task.projectId ? Number(task.projectId) : null,
        project: task.project ? String(task.project) : null,
        title: String(task.title),
        description: task.description ? String(task.description) : null,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee ? String(task.assignee) : null,
        assigneeId: task.assigneeId ? Number(task.assigneeId) : null,
        dueDate: task.dueDate ? String(task.dueDate) : null,
        comments: Number(task.comments ?? 0),
        attachments: Number(task.attachments ?? 0),
        labels: labelsByTask.get(task.id) ?? [],
        subtasksTotal: subtasksByTask.get(task.id)?.total ?? 0,
        subtasksCompleted: subtasksByTask.get(task.id)?.completed ?? 0,
      })),
    })
  } catch (error) {
    console.error("Fetch tasks failed:", error)
    return serverError("Could not load tasks")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, workspaceId, projectId, assigneeId, title, description, status, priority, dueDate, labelIds } = await request.json()
    const creatorId = Number(userId)
    const parsedWorkspaceId = Number(workspaceId)
    const taskTitle = String(title ?? "").trim()
    const taskDescription = String(description ?? "").trim()

    if (!Number.isInteger(creatorId) || creatorId < 1) {
      return badRequest("Missing user id")
    }

    if (!Number.isInteger(parsedWorkspaceId) || parsedWorkspaceId < 1) {
      return badRequest("Choose a workspace")
    }

    if (!taskTitle) {
      return badRequest("Task title is required")
    }

    const [membership] = await db.execute<RowDataPacket[]>(
      "SELECT workspace_id FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [parsedWorkspaceId, creatorId]
    )

    if (membership.length === 0) {
      return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 })
    }

    const safeStatus = ["todo", "in-progress", "review", "done"].includes(status) ? status : "todo"
    const safePriority = ["low", "medium", "high", "urgent"].includes(priority) ? priority : "medium"
    const safeDueDate = dueDate ? String(dueDate) : null
    const safeProjectId = Number.isInteger(Number(projectId)) && Number(projectId) > 0 ? Number(projectId) : null
    const safeAssigneeId = Number.isInteger(Number(assigneeId)) && Number(assigneeId) > 0 ? Number(assigneeId) : creatorId

    if (safeProjectId) {
      const [projectRows] = await db.execute<RowDataPacket[]>(
        "SELECT id FROM projects WHERE id = ? AND workspace_id = ? AND archived_at IS NULL LIMIT 1",
        [safeProjectId, parsedWorkspaceId]
      )

      if (projectRows.length === 0) {
        return badRequest("Choose a valid project")
      }
    }

    const [assigneeRows] = await db.execute<RowDataPacket[]>(
      "SELECT user_id FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [parsedWorkspaceId, safeAssigneeId]
    )

    if (assigneeRows.length === 0) {
      return badRequest("Choose a valid assignee")
    }

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, created_by, assignee_id, due_date, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${safeStatus === "done" ? "CURRENT_TIMESTAMP" : "NULL"})`,
      [
        parsedWorkspaceId,
        safeProjectId,
        taskTitle,
        taskDescription || null,
        safeStatus,
        safePriority,
        creatorId,
        safeAssigneeId,
        safeDueDate,
      ]
    )

    const parsedLabelIds = Array.isArray(labelIds)
      ? labelIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
      : []

    for (const labelId of parsedLabelIds) {
      await db.execute(
        "INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)",
        [result.insertId, labelId]
      )
    }

    await createNotification({
      userId: creatorId,
      type: "task",
      title: "Task created",
      body: `${taskTitle} was added to your workspace.`,
      entityType: "task",
      entityId: result.insertId,
    })
    if (safeAssigneeId !== creatorId) {
      await createNotification({
        userId: safeAssigneeId,
        type: "assignment",
        title: "New task assigned",
        body: `${taskTitle} was assigned to you.`,
        entityType: "task",
        entityId: result.insertId,
        dedupeHours: 24,
      })
    }
    await db.execute(
      `INSERT INTO activity_events (workspace_id, task_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, ?, 'created', 'task', ?, JSON_OBJECT('title', ?, 'status', ?, 'priority', ?))`,
      [parsedWorkspaceId, result.insertId, creatorId, result.insertId, taskTitle, safeStatus, safePriority]
    )

    return NextResponse.json({
      task: {
        id: result.insertId,
        workspaceId: parsedWorkspaceId,
        projectId: safeProjectId,
        title: taskTitle,
        description: taskDescription || null,
        status: safeStatus,
        priority: safePriority,
        assigneeId: safeAssigneeId,
        dueDate: safeDueDate,
        comments: 0,
        attachments: 0,
        labels: [],
        subtasksTotal: 0,
        subtasksCompleted: 0,
      },
    })
  } catch (error) {
    console.error("Create task failed:", error)
    return serverError("Could not create task")
  }
}
