import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { generateContextualAiResponse } from "@/lib/ai"
import { createNotification } from "@/lib/notifications"

export const aiNativeActionTypes = ["create_note", "create_reminder", "summarize_document", "build_checklist"] as const

export type AiNativeActionType = typeof aiNativeActionTypes[number]

export async function executeAiNativeAction(input: {
  userId: number
  workspaceId: number
  projectId?: number | null
  actionType: AiNativeActionType
  title?: string
  content: string
  confirmed?: boolean
}) {
  await assertWorkspaceAccess(input.userId, input.workspaceId)

  if (requiresConfirmation(input.actionType, input.content) && !input.confirmed) {
    throw new Error("Please confirm this AI action before running it.")
  }

  switch (input.actionType) {
    case "create_note":
      return createNoteAction(input)
    case "create_reminder":
      return createReminderAction(input)
    case "summarize_document":
      return summarizeDocumentAction(input)
    case "build_checklist":
      return buildChecklistAction(input)
  }
}

async function createNoteAction(input: {
  userId: number
  workspaceId: number
  projectId?: number | null
  title?: string
  content: string
}) {
  const title = cleanTitle(input.title || input.content, "AI Note")
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO notes (workspace_id, project_id, title, content, content_format, doc_type, created_by, updated_by)
    VALUES (?, ?, ?, ?, 'markdown', 'note', ?, ?)`,
    [input.workspaceId, input.projectId ?? null, title, input.content, input.userId, input.userId]
  )

  await logAction(input.workspaceId, input.userId, "ai_created_note", "note", result.insertId, title)
  return { type: "note", id: result.insertId, title }
}

async function createReminderAction(input: {
  userId: number
  workspaceId: number
  title?: string
  content: string
}) {
  const notification = await createNotification({
    userId: input.userId,
    type: "automation",
    title: cleanTitle(input.title || "AI reminder", "AI reminder"),
    body: input.content,
    entityType: "ai_action",
    entityId: null,
  })

  await logAction(input.workspaceId, input.userId, "ai_created_reminder", "notification", notification?.id ?? null, input.title || "AI reminder")
  return { type: "reminder", notification }
}

async function summarizeDocumentAction(input: {
  userId: number
  workspaceId: number
  content: string
}) {
  const result = await generateContextualAiResponse({
    userId: input.userId,
    workspaceId: input.workspaceId,
    systemPrompt: "Summarize this document for a task management workspace.",
    promptPrefix: "Return a concise summary, decisions, risks, and suggested next tasks.",
    content: input.content,
    templateName: "AI Document Action",
  })

  await logAction(input.workspaceId, input.userId, "ai_summarized_document", "ai_action", null, "Document summary")
  return { type: "summary", summary: result.reply, provider: result.provider, model: result.model }
}

async function buildChecklistAction(input: {
  userId: number
  workspaceId: number
  projectId?: number | null
  title?: string
  content: string
}) {
  const result = await generateContextualAiResponse({
    userId: input.userId,
    workspaceId: input.workspaceId,
    systemPrompt: "Turn this request into a concise checklist.",
    promptPrefix: "Return 4-8 checklist items, one per line, without numbering if possible.",
    content: input.content,
    templateName: "AI Checklist Action",
  })
  const checklist = result.reply
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 8)
  const title = cleanTitle(input.title || input.content, "AI Checklist")
  const [task] = await db.execute<ResultSetHeader>(
    `INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, created_by, assignee_id, ai_generated)
    VALUES (?, ?, ?, ?, 'todo', 'medium', ?, ?, TRUE)`,
    [input.workspaceId, input.projectId ?? null, title, input.content, input.userId, input.userId]
  )

  for (const [index, item] of checklist.entries()) {
    await db.execute(
      "INSERT INTO task_subtasks (task_id, title, sort_order) VALUES (?, ?, ?)",
      [task.insertId, item, index]
    )
  }

  await logAction(input.workspaceId, input.userId, "ai_built_checklist", "task", task.insertId, title)
  return { type: "checklist", taskId: task.insertId, title, checklist }
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

async function logAction(workspaceId: number, userId: number, action: string, entityType: string, entityId: number | null, title: string) {
  await db.execute(
    `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (?, ?, ?, ?, ?, JSON_OBJECT('title', ?, 'source', 'ai_native_action'))`,
    [workspaceId, userId, action, entityType, entityId, title]
  )
}

function requiresConfirmation(actionType: AiNativeActionType, content: string) {
  return actionType === "create_reminder" && /\b(send|email|submit|external|publish)\b/i.test(content)
}

function cleanTitle(value: string, fallback: string) {
  const title = value.replace(/\s+/g, " ").trim().slice(0, 120)
  return title || fallback
}
