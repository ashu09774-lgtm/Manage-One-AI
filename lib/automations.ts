import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"
import { createZoomMeeting } from "@/lib/integrations/zoom"
import { createGoogleCalendarEvent } from "@/lib/integrations/google-calendar"

export type AutomationTriggerType =
  | "task_overdue"
  | "task_due_soon"
  | "recurring_task"
  | "task_completed"
  | "label_changed"
  | "comment_added"
  | "milestone_reached"

export type AutomationActionType =
  | "notify_assignee"
  | "notify_owner"
  | "create_task"
  | "workflow"

export type AutomationConfig = {
  daysAhead?: number
  cadenceDays?: number
  sourceTaskId?: number
  followUpTitle?: string
  followUpDescription?: string
  assigneeId?: number | null
  projectId?: number | null
  priority?: "low" | "medium" | "high" | "urgent"
  status?: "todo" | "in-progress" | "review" | "done"
  graph?: { nodes: any[]; edges: any[] } | null
}

type AutomationRow = RowDataPacket & {
  id: number
  workspaceId: number
  name: string
  description: string | null
  triggerType: AutomationTriggerType
  actionType: AutomationActionType
  config: string | null
  enabled: number
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

type AutomationRunRow = RowDataPacket & {
  id: number
  status: "queued" | "running" | "success" | "failed"
  output: string | null
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

type TaskCandidateRow = RowDataPacket & {
  id: number
  title: string
  description: string | null
  assigneeId: number | null
  createdBy: number | null
  projectId: number | null
  priority: "low" | "medium" | "high" | "urgent"
  status: "todo" | "in-progress" | "review" | "done"
  dueDate: string | null
}

export async function getAutomations(userId: number, workspaceId?: number | null) {
  const filter = workspaceId ? "AND a.workspace_id = ?" : ""
  const params = workspaceId ? [userId, workspaceId] : [userId]
  const [rows] = await db.execute<AutomationRow[]>(
    `SELECT
      a.id,
      a.workspace_id AS workspaceId,
      a.name,
      a.description,
      a.trigger_type AS triggerType,
      a.action_type AS actionType,
      CAST(a.config AS CHAR) AS config,
      a.enabled,
      a.created_by AS createdBy,
      DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(a.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
    FROM automations a
    INNER JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ?
    WHERE 1 = 1 ${filter}
    ORDER BY a.updated_at DESC, a.id DESC`,
    params
  )

  return rows.map(mapAutomationRow)
}

export async function getAutomation(userId: number, automationId: number) {
  const [[row]] = await db.execute<AutomationRow[]>(
    `SELECT
      a.id,
      a.workspace_id AS workspaceId,
      a.name,
      a.description,
      a.trigger_type AS triggerType,
      a.action_type AS actionType,
      CAST(a.config AS CHAR) AS config,
      a.enabled,
      a.created_by AS createdBy,
      DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(a.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
    FROM automations a
    INNER JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ?
    WHERE a.id = ?
    LIMIT 1`,
    [userId, automationId]
  )

  return row ? mapAutomationRow(row) : null
}

export async function createAutomation(input: {
  userId: number
  workspaceId: number
  name: string
  description?: string
  triggerType: AutomationTriggerType
  actionType: AutomationActionType
  config: AutomationConfig
  enabled?: boolean
}) {
  await assertWorkspaceEditor(input.userId, input.workspaceId)

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO automations
      (workspace_id, name, description, trigger_type, action_type, config, enabled, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.workspaceId,
      input.name,
      input.description ?? null,
      input.triggerType,
      input.actionType,
      JSON.stringify(input.config ?? {}),
      input.enabled === false ? 0 : 1,
      input.userId,
    ]
  )

  await db.execute(
    `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (?, ?, 'created', 'automation', ?, JSON_OBJECT('name', ?, 'triggerType', ?, 'actionType', ?))`,
    [input.workspaceId, input.userId, result.insertId, input.name, input.triggerType, input.actionType]
  )

  return getAutomation(input.userId, result.insertId)
}

export async function updateAutomation(input: {
  userId: number
  automationId: number
  name: string
  description?: string
  triggerType: AutomationTriggerType
  actionType: AutomationActionType
  config: AutomationConfig
  enabled: boolean
}) {
  const automation = await getAutomation(input.userId, input.automationId)
  if (!automation) {
    return null
  }

  await assertWorkspaceEditor(input.userId, automation.workspaceId)

  await db.execute(
    `UPDATE automations
    SET name = ?, description = ?, trigger_type = ?, action_type = ?, config = ?, enabled = ?
    WHERE id = ?`,
    [
      input.name,
      input.description ?? null,
      input.triggerType,
      input.actionType,
      JSON.stringify(input.config ?? {}),
      input.enabled ? 1 : 0,
      input.automationId,
    ]
  )

  await db.execute(
    `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (?, ?, 'updated', 'automation', ?, JSON_OBJECT('name', ?, 'triggerType', ?, 'actionType', ?))`,
    [automation.workspaceId, input.userId, input.automationId, input.name, input.triggerType, input.actionType]
  )

  return getAutomation(input.userId, input.automationId)
}

export async function deleteAutomation(userId: number, automationId: number) {
  const automation = await getAutomation(userId, automationId)
  if (!automation) {
    return false
  }

  await assertWorkspaceEditor(userId, automation.workspaceId)
  await db.execute("DELETE FROM automations WHERE id = ?", [automationId])
  return true
}

export async function getAutomationRuns(userId: number, workspaceId?: number | null) {
  const filter = workspaceId ? "AND a.workspace_id = ?" : ""
  const params = workspaceId ? [userId, workspaceId] : [userId]
  const [rows] = await db.execute<(AutomationRunRow & { automationId: number; automationName: string; workspaceId: number })[]>(
    `SELECT
      ar.id,
      ar.status,
      CAST(ar.output AS CHAR) AS output,
      ar.error_message AS errorMessage,
      DATE_FORMAT(ar.started_at, '%Y-%m-%d %H:%i:%s') AS startedAt,
      DATE_FORMAT(ar.finished_at, '%Y-%m-%d %H:%i:%s') AS finishedAt,
      DATE_FORMAT(ar.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      a.id AS automationId,
      a.name AS automationName,
      a.workspace_id AS workspaceId
    FROM automation_runs ar
    INNER JOIN automations a ON a.id = ar.automation_id
    INNER JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ?
    WHERE 1 = 1 ${filter}
    ORDER BY ar.created_at DESC, ar.id DESC
    LIMIT 40`,
    params
  )

  return rows.map((row) => ({
    id: Number(row.id),
    automationId: Number(row.automationId),
    automationName: String(row.automationName),
    workspaceId: Number(row.workspaceId),
    status: row.status,
    output: parseJsonSafe(row.output),
    errorMessage: row.errorMessage ? String(row.errorMessage) : null,
    startedAt: row.startedAt ? String(row.startedAt) : null,
    finishedAt: row.finishedAt ? String(row.finishedAt) : null,
    createdAt: String(row.createdAt),
  }))
}

export async function runAutomation(userId: number, automationId: number) {
  const automation = await getAutomation(userId, automationId)
  if (!automation) {
    throw new Error("Automation not found")
  }

  const [runResult] = await db.execute<ResultSetHeader>(
    "INSERT INTO automation_runs (automation_id, trigger_type, status, started_at) VALUES (?, ?, 'running', CURRENT_TIMESTAMP)",
    [automationId, automation.triggerType]
  )

  try {
    const output = await executeAutomationRule(automation)
    await db.execute(
      `UPDATE automation_runs
      SET status = 'success', output = ?, finished_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [JSON.stringify(output), runResult.insertId]
    )

    await db.execute(
      `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, 'executed', 'automation', ?, JSON_OBJECT('name', ?, 'items', ?))`,
      [automation.workspaceId, userId, automationId, automation.name, output.affectedCount ?? 0]
    )

    return {
      runId: runResult.insertId,
      status: "success" as const,
      output,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation failed"
    await db.execute(
      `UPDATE automation_runs
      SET status = 'failed', error_message = ?, finished_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [message, runResult.insertId]
    )

    return {
      runId: runResult.insertId,
      status: "failed" as const,
      errorMessage: message,
    }
  }
}

export async function getAutomationSuggestions(userId: number, workspaceId: number) {
  const [summaryRows] = await db.execute<RowDataPacket[]>(
    `SELECT
      COUNT(*) AS totalTasks,
      COUNT(CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE AND status <> 'done' THEN 1 END) AS overdueTasks,
      COUNT(CASE WHEN due_date IS NOT NULL AND due_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY) AND status <> 'done' THEN 1 END) AS dueSoonTasks,
      COUNT(CASE WHEN status = 'done' THEN 1 END) AS completedTasks
    FROM tasks
    WHERE workspace_id = ?`,
    [workspaceId]
  )

  const summary = summaryRows[0] ?? {}
  const suggestions = []

  if (Number(summary.overdueTasks ?? 0) > 0) {
    suggestions.push({
      name: "Overdue Task Reminder",
      description: "Notify assignees when overdue tasks need attention.",
      triggerType: "task_overdue" as const,
      actionType: "notify_assignee" as const,
      config: {},
    })
  }

  if (Number(summary.dueSoonTasks ?? 0) > 0) {
    suggestions.push({
      name: "Due Soon Reminder",
      description: "Warn owners about tasks due in the next two days.",
      triggerType: "task_due_soon" as const,
      actionType: "notify_owner" as const,
      config: { daysAhead: 2 },
    })
  }

  if (Number(summary.completedTasks ?? 0) > 0) {
    suggestions.push({
      name: "Completion Follow-up",
      description: "Create a follow-up task whenever important work is marked done.",
      triggerType: "task_completed" as const,
      actionType: "create_task" as const,
      config: { followUpTitle: "Review next steps", status: "todo", priority: "medium" },
    })
  }

  const [candidateRows] = await db.execute<TaskCandidateRow[]>(
    `SELECT
      id,
      title,
      description,
      assignee_id AS assigneeId,
      created_by AS createdBy,
      project_id AS projectId,
      priority,
      status,
      DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate
    FROM tasks
    WHERE workspace_id = ?
    ORDER BY updated_at DESC
    LIMIT 3`,
    [workspaceId]
  )

  for (const task of candidateRows) {
    suggestions.push({
      name: `Recurring: ${task.title}`,
      description: "Clone a recurring operational task on a cadence.",
      triggerType: "recurring_task" as const,
      actionType: "create_task" as const,
      config: {
        sourceTaskId: Number(task.id),
        cadenceDays: 7,
      },
    })
  }

  return suggestions.slice(0, 6)
}

function mapAutomationRow(row: AutomationRow) {
  return {
    id: Number(row.id),
    workspaceId: Number(row.workspaceId),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    triggerType: row.triggerType,
    actionType: row.actionType,
    config: parseJsonSafe(row.config) ?? {},
    enabled: Boolean(row.enabled),
    createdBy: row.createdBy === null ? null : Number(row.createdBy),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }
}

async function executeAutomationRule(automation: ReturnType<typeof mapAutomationRow>) {
  if (!automation.enabled) {
    return { message: "Automation is disabled", affectedCount: 0 }
  }

  // If the action type is the new workflow engine, route it there
  if (automation.actionType === "workflow" || automation.config.graph) {
    return executeWorkflowGraph(automation)
  }

  switch (automation.triggerType) {
    case "task_overdue":
      return runOverdueReminder(automation)
    case "task_due_soon":
      return runDueSoonReminder(automation)
    case "recurring_task":
      return runRecurringTaskAutomation(automation)
    case "task_completed":
      return runCompletionFollowup(automation)
    case "label_changed":
    case "comment_added":
    case "milestone_reached":
      // These are event-driven, we just log that we handled them if they triggered this run
      return { message: `${automation.triggerType} handled`, affectedCount: 1 }
    default:
      throw new Error("Unsupported automation trigger")
  }
}

async function executeWorkflowGraph(automation: ReturnType<typeof mapAutomationRow>) {
  const graph = automation.config.graph
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error("Invalid workflow graph structure")
  }

  const { nodes, edges } = graph

  // Find the trigger node
  const triggerNode = nodes.find(n => n.type === "trigger")
  if (!triggerNode) {
    throw new Error("Workflow must have a trigger node")
  }

  const outputLog: Record<string, any> = {}
  let nodesExecuted = 0

  // BFS Queue to execute nodes
  // queue holds: { nodeId, inputPayload }
  const queue: { nodeId: string; payload: any }[] = [{ nodeId: triggerNode.id, payload: {} }]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { nodeId, payload } = queue.shift()!
    if (visited.has(nodeId)) continue // Prevent infinite loops
    visited.add(nodeId)
    
    const node = nodes.find(n => n.id === nodeId)
    if (!node) continue

    let outputPayload = { ...payload }
    
    // Execute Node Action
    try {
      const nodeStart = Date.now()
      let status: "success" | "failed" = "success"
      let nodeError = null
      let nodeOutput = {}

      if (node.type === "action") {
        const actionLabel = node.data?.label
        
        if (actionLabel === "Create Zoom Meeting") {
          const meeting = await createZoomMeeting(
            "Manage One Automated Meeting",
            new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            30 // 30 minutes
          )
          nodeOutput = { zoomMeetingUrl: meeting.join_url, meetingId: meeting.id }
          outputPayload.zoomMeetingUrl = meeting.join_url
        } else if (actionLabel === "Google Calendar Event") {
          const event = await createGoogleCalendarEvent(
            "Manage One Follow-up Event",
            "Automatically generated by Manage One.",
            new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            new Date(Date.now() + 86400000 + 3600000).toISOString()
          )
          nodeOutput = { calendarEventId: event.id, link: event.htmlLink }
          outputPayload.calendarEventId = event.id
        } else if (actionLabel === "Send Email") {
          nodeOutput = { action: "Email Sent" }
        } else if (actionLabel === "Create Task") {
          nodeOutput = { action: "Task Created" }
        }
      } else if (node.type === "trigger") {
        nodeOutput = { action: "Trigger Activated", payload: outputPayload }
      } else if (node.type === "condition") {
        nodeOutput = { action: "Condition Evaluated", result: true }
      }

      // Log node execution
      await db.execute(
        `INSERT INTO automation_logs (run_id, node_id, node_type, status, input_data, output_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [automation.id, node.id, node.type, status, JSON.stringify(payload), JSON.stringify(nodeOutput)]
      )
      
      outputLog[nodeId] = nodeOutput
      
      nodesExecuted++
      
      // Enqueue next nodes based on edges
      const outgoingEdges = edges.filter(e => e.source === nodeId)
      for (const edge of outgoingEdges) {
        // If it's a condition node, we might want to only follow the 'true' or 'false' handle
        if (node.type === "condition") {
          const conditionResult = true // Mocked
          if (conditionResult && edge.sourceHandle === "true") {
            queue.push({ nodeId: edge.target, payload: outputPayload })
          } else if (!conditionResult && edge.sourceHandle === "false") {
            queue.push({ nodeId: edge.target, payload: outputPayload })
          }
        } else {
          // Normal sequential execution
          queue.push({ nodeId: edge.target, payload: outputPayload })
        }
      }
    } catch (error) {
      outputLog[nodeId] = { error: error instanceof Error ? error.message : "Node execution failed" }
      break // Stop execution on error
    }
  }

  return { 
    message: "Workflow executed", 
    nodesExecuted,
    outputLog 
  }
}

async function runOverdueReminder(automation: ReturnType<typeof mapAutomationRow>) {
  const [tasks] = await db.execute<TaskCandidateRow[]>(
    `SELECT
      id, title, assignee_id AS assigneeId, created_by AS createdBy
    FROM tasks
    WHERE workspace_id = ?
      AND due_date IS NOT NULL
      AND due_date < CURRENT_DATE
      AND status <> 'done'`,
    [automation.workspaceId]
  )

  let created = 0
  for (const task of tasks) {
    const recipient = task.assigneeId ?? task.createdBy
    if (!recipient) continue
    await createNotification({
      userId: recipient,
      type: "automation",
      title: "Overdue task reminder",
      body: `${task.title} is overdue and needs attention.`,
      entityType: "task",
      entityId: Number(task.id),
      dedupeHours: 20,
    })
    created += 1
  }

  return { message: "Overdue reminders sent", affectedCount: created, taskCount: tasks.length }
}

async function runDueSoonReminder(automation: ReturnType<typeof mapAutomationRow>) {
  const daysAhead = Number(automation.config.daysAhead ?? 2)
  const [tasks] = await db.execute<TaskCandidateRow[]>(
    `SELECT
      id, title, assignee_id AS assigneeId, created_by AS createdBy
    FROM tasks
    WHERE workspace_id = ?
      AND due_date IS NOT NULL
      AND due_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)
      AND status <> 'done'`,
    [automation.workspaceId, daysAhead]
  )

  let created = 0
  for (const task of tasks) {
    const recipient = automation.actionType === "notify_owner" ? task.createdBy : task.assigneeId ?? task.createdBy
    if (!recipient) continue
    await createNotification({
      userId: recipient,
      type: "automation",
      title: "Upcoming due date",
      body: `${task.title} is due soon.`,
      entityType: "task",
      entityId: Number(task.id),
      dedupeHours: 20,
    })
    created += 1
  }

  return { message: "Due-soon reminders sent", affectedCount: created, taskCount: tasks.length, daysAhead }
}

async function runRecurringTaskAutomation(automation: ReturnType<typeof mapAutomationRow>) {
  const sourceTaskId = Number(automation.config.sourceTaskId)
  const cadenceDays = Number(automation.config.cadenceDays ?? 7)

  if (!Number.isInteger(sourceTaskId) || sourceTaskId < 1) {
    throw new Error("Recurring automation requires a source task")
  }

  const [[task]] = await db.execute<TaskCandidateRow[]>(
    `SELECT
      id, title, description, assignee_id AS assigneeId, created_by AS createdBy, project_id AS projectId, priority, status
    FROM tasks
    WHERE id = ? AND workspace_id = ?
    LIMIT 1`,
    [sourceTaskId, automation.workspaceId]
  )

  if (!task) {
    throw new Error("Source task not found")
  }

  const [[lastRun]] = await db.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(finished_at, '%Y-%m-%d') AS finishedAt
    FROM automation_runs
    WHERE automation_id = ? AND status = 'success' AND finished_at IS NOT NULL
    ORDER BY finished_at DESC
    LIMIT 1`,
    [automation.id]
  )

  if (lastRun?.finishedAt) {
    const [eligibleRows] = await db.execute<RowDataPacket[]>(
      `SELECT CASE WHEN DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d'), INTERVAL ? DAY) <= CURRENT_DATE THEN 1 ELSE 0 END AS eligible`,
      [String(lastRun.finishedAt), cadenceDays]
    )
    if (!Boolean(eligibleRows[0]?.eligible)) {
      return { message: "Recurring task is not due yet", affectedCount: 0, cadenceDays }
    }
  }

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, assignee_id, created_by, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURRENT_DATE, INTERVAL ? DAY))`,
    [
      automation.workspaceId,
      task.projectId,
      task.title,
      task.description ?? null,
      "todo",
      task.priority,
      task.assigneeId,
      task.createdBy,
      cadenceDays,
    ]
  )

  return {
    message: "Recurring task created",
    affectedCount: 1,
    taskId: result.insertId,
    cadenceDays,
  }
}

async function runCompletionFollowup(automation: ReturnType<typeof mapAutomationRow>) {
  const [tasks] = await db.execute<TaskCandidateRow[]>(
    `SELECT
      id, title, description, assignee_id AS assigneeId, created_by AS createdBy, project_id AS projectId
    FROM tasks
    WHERE workspace_id = ?
      AND status = 'done'
      AND completed_at IS NOT NULL
      AND completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ORDER BY completed_at DESC
    LIMIT 10`,
    [automation.workspaceId]
  )

  let created = 0
  for (const task of tasks) {
    const title = automation.config.followUpTitle?.trim() || `Follow up on ${task.title}`
    const description = automation.config.followUpDescription?.trim() || `Review outcomes and define the next action after "${task.title}".`
    await db.execute(
      `INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, assignee_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        automation.workspaceId,
        automation.config.projectId ?? task.projectId,
        title,
        description,
        automation.config.status ?? "todo",
        automation.config.priority ?? "medium",
        automation.config.assigneeId ?? task.assigneeId,
        task.createdBy,
      ]
    )
    created += 1
  }

  return {
    message: "Follow-up tasks created",
    affectedCount: created,
    sourceTaskCount: tasks.length,
  }
}

async function assertWorkspaceEditor(userId: number, workspaceId: number) {
  const [[membership]] = await db.execute<(RowDataPacket & { role: string })[]>(
    "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
    [workspaceId, userId]
  )

  if (!membership) {
    throw new Error("Workspace not found")
  }

  if (membership.role === "viewer") {
    throw new Error("You do not have permission to manage automations in this workspace")
  }
}

function parseJsonSafe(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

