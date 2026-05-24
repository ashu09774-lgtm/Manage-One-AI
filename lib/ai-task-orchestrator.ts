import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { generateContextualAiResponse } from "@/lib/ai"
import { createNotification } from "@/lib/notifications"

export type GeneratedTaskInput = {
  title: string
  description?: string | null
  priority?: "low" | "medium" | "high" | "urgent"
  dueDate?: string | null
  subtasks?: string[]
}

type CreatedTask = GeneratedTaskInput & {
  id: number
  status: "todo"
}

const validPriorities = new Set(["low", "medium", "high", "urgent"])

export type AiTaskPlanOptions = {
  userId: number
  workspaceId?: number | null
  projectId?: number | null
  goal: string
  dueDateStyle?: "none" | "flexible" | "this-week"
  includeSubtasks?: boolean
  confirmed?: boolean
}

export async function previewAiTaskPlan(input: AiTaskPlanOptions) {
  const workspaceId = input.workspaceId ?? await getDefaultWorkspaceId(input.userId)
  if (!workspaceId) {
    throw new Error("Create a workspace before asking AI to create tasks.")
  }

  await assertWorkspaceAccess(input.userId, workspaceId)
  const projectId = input.projectId ? await getValidProjectId(input.projectId, workspaceId) : null
  const result = await generateContextualAiResponse({
    userId: input.userId,
    workspaceId,
    systemPrompt: [
      "You convert user goals into concrete task records for a task management app.",
      "Return practical tasks the user can track. Only include tasks that belong in the app.",
      "At the end of the response, include a JSON array in a fenced json block.",
    ].join(" "),
    promptPrefix: [
      "Each JSON item must include title, description, priority, dueDate, and subtasks.",
      "priority must be low, medium, high, or urgent.",
      `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
      buildDueDateInstruction(input.dueDateStyle ?? "flexible"),
      input.includeSubtasks === false
        ? "Set subtasks to an empty array for every task."
        : "Include 2-5 useful subtasks for each task when it helps execution.",
      "Create 3-8 tasks unless the goal is very small.",
    ].join(" "),
    content: `Goal: ${input.goal}`,
    templateName: "AI Task Creator",
  })

  return {
    workspaceId,
    projectId,
    goal: input.goal,
    tasks: parseGeneratedTasks(result.reply, input.goal),
    requiresConfirmation: isHighRiskGoal(input.goal),
    provider: result.provider,
    model: result.model,
    status: result.status,
  }
}

export async function createAiTaskPlan(input: AiTaskPlanOptions & { tasks?: GeneratedTaskInput[] }) {
  const workspaceId = input.workspaceId ?? await getDefaultWorkspaceId(input.userId)
  if (!workspaceId) {
    throw new Error("Create a workspace before asking AI to create tasks.")
  }

  await assertWorkspaceAccess(input.userId, workspaceId)
  const projectId = input.projectId ? await getValidProjectId(input.projectId, workspaceId) : null
  if (isHighRiskGoal(input.goal) && !input.confirmed) {
    throw new Error("Please confirm this AI plan before saving it.")
  }

  const [runResult] = await db.execute<ResultSetHeader>(
    `INSERT INTO ai_agent_runs (user_id, workspace_id, goal, status)
    VALUES (?, ?, ?, 'running')`,
    [input.userId, workspaceId, input.goal]
  )
  const runId = runResult.insertId

  try {
    await createPlannerStep(runId, input.goal)
    const preview = input.tasks
      ? {
        tasks: input.tasks.map((task) => normalizeGeneratedTask(task)).filter((task): task is GeneratedTaskInput => Boolean(task)).slice(0, 10),
        provider: "manage-one-local",
        model: "approved-preview",
        status: "success" as const,
      }
      : await previewAiTaskPlan(input)
    const generatedTasks = preview.tasks.length > 0 ? preview.tasks : fallbackTasks(input.goal)
    const createdTasks = await insertGeneratedTasks({
      userId: input.userId,
      workspaceId,
      projectId,
      runId,
      tasks: generatedTasks,
    })

    await db.execute(
      `UPDATE ai_agent_steps
      SET status = 'success', output_text = ?, finished_at = CURRENT_TIMESTAMP
      WHERE run_id = ? AND agent_type = 'planner'`,
      [JSON.stringify(generatedTasks, null, 2), runId]
    )

    const finalOutput = buildFinalOutput(input.goal, createdTasks)
    await db.execute(
      `UPDATE ai_agent_runs
      SET status = 'success', final_output = ?, error_message = NULL
      WHERE id = ? AND user_id = ?`,
      [finalOutput, runId, input.userId]
    )

    await createNotification({
      userId: input.userId,
      type: "automation",
      title: "AI task plan created",
      body: `${createdTasks.length} tasks were created for: ${input.goal}`,
      entityType: "ai_agent_run",
      entityId: runId,
    })

    await db.execute(
      `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, 'ai_task_plan_created', 'ai_agent_run', ?, JSON_OBJECT('goal', ?, 'taskCount', ?))`,
      [workspaceId, input.userId, runId, input.goal, createdTasks.length]
    )

    return {
      runId,
      workspaceId,
      projectId,
      goal: input.goal,
      tasks: createdTasks,
      provider: preview.provider,
      model: preview.model,
      status: preview.status,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown AI task creation failure"
    await db.execute(
      `UPDATE ai_agent_runs
      SET status = 'failed', error_message = ?, final_output = ?
      WHERE id = ? AND user_id = ?`,
      [errorMessage, `AI task plan failed for goal: ${input.goal}`, runId, input.userId]
    )
    await db.execute(
      `UPDATE ai_agent_steps
      SET status = 'failed', error_message = ?, finished_at = CURRENT_TIMESTAMP
      WHERE run_id = ? AND agent_type = 'planner'`,
      [errorMessage, runId]
    )
    throw error
  }
}

export async function getAiTaskGroups(userId: number, workspaceId?: number | null) {
  const filter = workspaceId ? "AND ar.workspace_id = ?" : ""
  const params = workspaceId ? [userId, workspaceId] : [userId]
  const [groups] = await db.execute<RowDataPacket[]>(
    `SELECT
      ar.id,
      ar.goal,
      ar.workspace_id AS workspaceId,
      w.name AS workspace,
      COUNT(t.id) AS total,
      COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed,
      MAX(t.updated_at) AS updatedAt
    FROM ai_agent_runs ar
    INNER JOIN tasks t ON t.ai_agent_run_id = ar.id AND t.ai_generated = TRUE
    LEFT JOIN workspaces w ON w.id = ar.workspace_id
    WHERE ar.user_id = ? ${filter}
    GROUP BY ar.id, ar.goal, ar.workspace_id, w.name
    ORDER BY updatedAt DESC, ar.id DESC
    LIMIT 20`,
    params
  )

  return groups.map((group) => {
    const total = Number(group.total ?? 0)
    const completed = Number(group.completed ?? 0)
    return {
      id: Number(group.id),
      goal: String(group.goal),
      workspaceId: group.workspaceId ? Number(group.workspaceId) : null,
      workspace: group.workspace ? String(group.workspace) : null,
      total,
      completed,
      progress: total ? Math.round((completed / total) * 100) : 0,
    }
  })
}

export async function completeAiTaskGroup(input: { userId: number; runId: number }) {
  const [[run]] = await db.execute<RowDataPacket[]>(
    "SELECT id, workspace_id AS workspaceId, goal FROM ai_agent_runs WHERE id = ? AND user_id = ? LIMIT 1",
    [input.runId, input.userId]
  )

  if (!run) {
    throw new Error("AI task group not found.")
  }

  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE tasks
    SET status = 'done', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
    WHERE ai_agent_run_id = ? AND ai_generated = TRUE AND status <> 'done'`,
    [input.runId]
  )

  await createNotification({
    userId: input.userId,
    type: "automation",
    title: "AI goal completed",
    body: `All tasks are done for: ${String(run.goal)}`,
    entityType: "ai_agent_run",
    entityId: input.runId,
    dedupeHours: 720,
  })

  await db.execute(
    `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (?, ?, 'ai_task_group_completed', 'ai_agent_run', ?, JSON_OBJECT('goal', ?, 'updatedTasks', ?))`,
    [run.workspaceId ?? null, input.userId, input.runId, String(run.goal), result.affectedRows]
  )

  return { updated: result.affectedRows }
}

export async function notifyAiGoalIfCompleted(input: { taskId: number; userId: number }) {
  const [[task]] = await db.execute<RowDataPacket[]>(
    `SELECT ai_agent_run_id AS runId, title
    FROM tasks
    WHERE id = ? AND ai_generated = TRUE
    LIMIT 1`,
    [input.taskId]
  )

  const runId = Number(task?.runId ?? 0)
  if (!runId) return null

  const [[summary]] = await db.execute<RowDataPacket[]>(
    `SELECT
      ar.goal,
      COUNT(t.id) AS total,
      COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS done
    FROM ai_agent_runs ar
    INNER JOIN tasks t ON t.ai_agent_run_id = ar.id
    WHERE ar.id = ? AND ar.user_id = ?
    GROUP BY ar.id, ar.goal
    LIMIT 1`,
    [runId, input.userId]
  )

  const total = Number(summary?.total ?? 0)
  const done = Number(summary?.done ?? 0)
  if (!total || total !== done) return null

  return createNotification({
    userId: input.userId,
    type: "automation",
    title: "AI goal completed",
    body: `All ${total} tasks are done for: ${String(summary.goal)}`,
    entityType: "ai_agent_run",
    entityId: runId,
    dedupeHours: 720,
  })
}

async function getDefaultWorkspaceId(userId: number) {
  const [[workspace]] = await db.execute<RowDataPacket[]>(
    `SELECT w.id
    FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
    WHERE w.archived_at IS NULL
    ORDER BY w.updated_at DESC
    LIMIT 1`,
    [userId]
  )

  return workspace?.id ? Number(workspace.id) : null
}

async function assertWorkspaceAccess(userId: number, workspaceId: number) {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT workspace_id FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
    [workspaceId, userId]
  )

  if (rows.length === 0) {
    throw new Error("You do not have access to this workspace.")
  }
}

async function getValidProjectId(projectId: number, workspaceId: number) {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id FROM projects WHERE id = ? AND workspace_id = ? AND archived_at IS NULL LIMIT 1",
    [projectId, workspaceId]
  )

  return rows.length > 0 ? projectId : null
}

async function createPlannerStep(runId: number, goal: string) {
  await db.execute(
    `INSERT INTO ai_agent_steps (run_id, agent_type, step_order, status, input_text, started_at)
    VALUES (?, 'planner', 1, 'running', ?, CURRENT_TIMESTAMP)`,
    [runId, goal]
  )
}

async function insertGeneratedTasks(input: {
  userId: number
  workspaceId: number
  projectId: number | null
  runId: number
  tasks: GeneratedTaskInput[]
}) {
  const createdTasks: CreatedTask[] = []

  for (const [index, task] of input.tasks.entries()) {
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO tasks
        (workspace_id, project_id, title, description, status, priority, created_by, assignee_id, due_date, sort_order, ai_generated, ai_agent_run_id)
      VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, TRUE, ?)`,
      [
        input.workspaceId,
        input.projectId,
        task.title,
        task.description ?? null,
        task.priority ?? "medium",
        input.userId,
        input.userId,
        task.dueDate ?? null,
        index,
        input.runId,
      ]
    )

    for (const [subtaskIndex, subtask] of (task.subtasks ?? []).entries()) {
      await db.execute(
        "INSERT INTO task_subtasks (task_id, title, sort_order) VALUES (?, ?, ?)",
        [result.insertId, subtask, subtaskIndex]
      )
    }

    await db.execute(
      `INSERT INTO activity_events (workspace_id, task_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, ?, 'ai_task_created', 'task', ?, JSON_OBJECT('title', ?, 'runId', ?))`,
      [input.workspaceId, result.insertId, input.userId, result.insertId, task.title, input.runId]
    )

    createdTasks.push({ ...task, id: result.insertId, status: "todo" })
  }

  return createdTasks
}

function buildDueDateInstruction(style: "none" | "flexible" | "this-week") {
  switch (style) {
    case "none":
      return "Set dueDate to null for every task."
    case "this-week":
      return "Assign dueDate values within the next 7 days when a sequence is useful."
    default:
      return "Use dueDate values only when they make the plan easier to execute; otherwise use null."
  }
}

function isHighRiskGoal(goal: string) {
  return /\b(delete|remove|drop|erase|publish|send|email|submit|pay|purchase|deploy|external)\b/i.test(goal)
}

function parseGeneratedTasks(reply: string, goal: string): GeneratedTaskInput[] {
  const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/i) ?? reply.match(/(\[[\s\S]*\])/)
  if (!jsonMatch?.[1]) {
    return fallbackTasks(goal)
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]) as unknown
    if (!Array.isArray(parsed)) return fallbackTasks(goal)

    const tasks = parsed
      .map((item) => normalizeGeneratedTask(item))
      .filter((task): task is GeneratedTaskInput => Boolean(task))
      .slice(0, 10)

    return tasks.length > 0 ? tasks : fallbackTasks(goal)
  } catch {
    return fallbackTasks(goal)
  }
}

function normalizeGeneratedTask(item: unknown): GeneratedTaskInput | null {
  const task = item as Record<string, unknown>
  const title = String(task.title ?? "").trim().slice(0, 220)
  if (!title) return null

  const priority = String(task.priority ?? "medium").toLowerCase()
  const dueDate = String(task.dueDate ?? "").trim()
  const subtasks = Array.isArray(task.subtasks)
    ? task.subtasks.map((subtask) => String(subtask ?? "").trim().slice(0, 220)).filter(Boolean).slice(0, 8)
    : []

  return {
    title,
    description: String(task.description ?? "").trim().slice(0, 2000) || null,
    priority: validPriorities.has(priority) ? priority as GeneratedTaskInput["priority"] : "medium",
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
    subtasks,
  }
}

function fallbackTasks(goal: string): GeneratedTaskInput[] {
  return [
    {
      title: `Define success criteria for ${goal}`,
      description: "Clarify what done means, what should be delivered, and any constraints.",
      priority: "high",
      dueDate: null,
      subtasks: ["Write acceptance criteria", "List blockers and assumptions"],
    },
    {
      title: `Break down ${goal} into execution steps`,
      description: "Create the concrete work items needed to make progress.",
      priority: "medium",
      dueDate: null,
      subtasks: ["Sequence the work", "Identify dependencies"],
    },
    {
      title: `Complete and review ${goal}`,
      description: "Finish the planned work, check quality, and prepare the final handoff.",
      priority: "medium",
      dueDate: null,
      subtasks: ["Finish open items", "Review the outcome", "Share completion status"],
    },
  ]
}

function buildFinalOutput(goal: string, tasks: CreatedTask[]) {
  return [
    "AI task plan created",
    "",
    `Goal: ${goal}`,
    "",
    "Created tasks:",
    ...tasks.map((task, index) => `${index + 1}. ${task.title} (${task.priority ?? "medium"})`),
  ].join("\n")
}
