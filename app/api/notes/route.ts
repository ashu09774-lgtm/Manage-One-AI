import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { emitWorkspaceEvent } from "@/lib/realtime"

type NoteRow = RowDataPacket & {
  id: number
  workspaceId: number
  workspaceName: string
  projectId: number | null
  projectName: string | null
  title: string
  content: string
  contentFormat: "plain" | "markdown"
  docType: "note" | "documentation"
  createdBy: number | null
  createdByName: string | null
  updatedBy: number | null
  updatedByName: string | null
  createdAt: string
  updatedAt: string
  linkedTasks: number
  revisions: number
}

export async function GET(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const workspaceId = Number(searchParams.get("workspaceId"))
  const query = String(searchParams.get("q") ?? "").trim()
  const docType = String(searchParams.get("docType") ?? "all")

  if (!userId) {
    return badRequest("Missing user id")
  }

  const params: Array<number | string> = [userId]
  const filters = ["1 = 1"]

  if (Number.isInteger(workspaceId) && workspaceId > 0) {
    filters.push("n.workspace_id = ?")
    params.push(workspaceId)
  }

  if (docType === "note" || docType === "documentation") {
    filters.push("n.doc_type = ?")
    params.push(docType)
  }

  if (query) {
    filters.push("(n.title LIKE ? OR n.content LIKE ? OR p.name LIKE ?)")
    params.push(`%${query}%`, `%${query}%`, `%${query}%`)
  }

  try {
    const [notes] = await db.execute<NoteRow[]>(
      `SELECT
        n.id,
        n.workspace_id AS workspaceId,
        w.name AS workspaceName,
        n.project_id AS projectId,
        p.name AS projectName,
        n.title,
        n.content,
        n.content_format AS contentFormat,
        n.doc_type AS docType,
        n.created_by AS createdBy,
        creator.name AS createdByName,
        n.updated_by AS updatedBy,
        updater.name AS updatedByName,
        DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        DATE_FORMAT(n.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt,
        COUNT(DISTINCT ntl.task_id) AS linkedTasks,
        COUNT(DISTINCT nr.id) AS revisions
      FROM notes n
      INNER JOIN workspaces w ON w.id = n.workspace_id
      INNER JOIN workspace_members wm ON wm.workspace_id = n.workspace_id AND wm.user_id = ?
      LEFT JOIN projects p ON p.id = n.project_id
      LEFT JOIN users creator ON creator.id = n.created_by
      LEFT JOIN users updater ON updater.id = n.updated_by
      LEFT JOIN note_task_links ntl ON ntl.note_id = n.id
      LEFT JOIN note_revisions nr ON nr.note_id = n.id
      WHERE ${filters.join(" AND ")}
      GROUP BY n.id, n.workspace_id, w.name, n.project_id, p.name, n.title, n.content, n.content_format, n.doc_type, n.created_by, creator.name, n.updated_by, updater.name, n.created_at, n.updated_at
      ORDER BY n.updated_at DESC, n.id DESC`,
      params
    )

    return NextResponse.json({
      notes: notes.map(formatNoteSummary),
    })
  } catch (error) {
    console.error("Fetch notes failed:", error)
    return serverError("Could not load notes")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, workspaceId, projectId, title, content, docType, taskIds } = await request.json()
    const actorId = Number(userId)
    const parsedWorkspaceId = Number(workspaceId)
    const noteTitle = String(title ?? "").trim()
    const noteContent = String(content ?? "").trim()
    const safeDocType = docType === "documentation" ? "documentation" : "note"
    const safeProjectId = Number.isInteger(Number(projectId)) && Number(projectId) > 0 ? Number(projectId) : null

    if (!Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Missing user id")
    }

    if (!Number.isInteger(parsedWorkspaceId) || parsedWorkspaceId < 1) {
      return badRequest("Choose a workspace")
    }

    if (!noteTitle) {
      return badRequest("Title is required")
    }

    const canAccess = await assertWorkspaceAccess(parsedWorkspaceId, actorId)
    if (!canAccess) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (safeProjectId) {
      const [projectRows] = await db.execute<RowDataPacket[]>(
        "SELECT id FROM projects WHERE id = ? AND workspace_id = ? AND archived_at IS NULL LIMIT 1",
        [safeProjectId, parsedWorkspaceId]
      )

      if (projectRows.length === 0) {
        return badRequest("Choose a valid project")
      }
    }

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO notes (workspace_id, project_id, title, content, content_format, doc_type, created_by, updated_by)
      VALUES (?, ?, ?, ?, 'markdown', ?, ?, ?)`,
      [parsedWorkspaceId, safeProjectId, noteTitle, noteContent, safeDocType, actorId, actorId]
    )

    const linkedTaskIds = await syncTaskLinks(result.insertId, parsedWorkspaceId, taskIds)

    await db.execute(
      `INSERT INTO note_revisions (note_id, title, content, edited_by)
      VALUES (?, ?, ?, ?)`,
      [result.insertId, noteTitle, noteContent, actorId]
    )

    await db.execute(
      `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, 'created', 'note', ?, JSON_OBJECT('title', ?, 'docType', ?))`,
      [parsedWorkspaceId, actorId, result.insertId, noteTitle, safeDocType]
    )

    emitWorkspaceEvent(parsedWorkspaceId, "note_updated", {
      id: result.insertId,
      title: noteTitle,
      action: "created",
      docType: safeDocType,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      note: {
        id: result.insertId,
        workspaceId: parsedWorkspaceId,
        projectId: safeProjectId,
        title: noteTitle,
        content: noteContent,
        contentFormat: "markdown",
        docType: safeDocType,
        taskIds: linkedTaskIds,
        linkedTasks: linkedTaskIds.length,
        revisions: 1,
      },
    })
  } catch (error) {
    console.error("Create note failed:", error)
    return serverError("Could not create note")
  }
}

async function assertWorkspaceAccess(workspaceId: number, userId: number) {
  const [[membership]] = await db.execute<RowDataPacket[]>(
    "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
    [workspaceId, userId]
  )

  return Boolean(membership)
}

async function syncTaskLinks(noteId: number, workspaceId: number, taskIds: unknown) {
  const parsedTaskIds = Array.isArray(taskIds)
    ? [...new Set(taskIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
    : []

  if (parsedTaskIds.length === 0) {
    return []
  }

  const [tasks] = await db.execute<RowDataPacket[]>(
    `SELECT id FROM tasks
    WHERE workspace_id = ? AND id IN (${parsedTaskIds.map(() => "?").join(",")})`,
    [workspaceId, ...parsedTaskIds]
  )
  const validTaskIds = tasks.map((task) => Number(task.id))

  for (const taskId of validTaskIds) {
    await db.execute(
      "INSERT IGNORE INTO note_task_links (note_id, task_id) VALUES (?, ?)",
      [noteId, taskId]
    )
  }

  return validTaskIds
}

function formatNoteSummary(note: NoteRow) {
  return {
    id: Number(note.id),
    workspaceId: Number(note.workspaceId),
    workspaceName: String(note.workspaceName),
    projectId: note.projectId ? Number(note.projectId) : null,
    projectName: note.projectName ? String(note.projectName) : null,
    title: String(note.title),
    content: String(note.content),
    contentFormat: note.contentFormat,
    docType: note.docType,
    createdBy: note.createdBy ? Number(note.createdBy) : null,
    createdByName: note.createdByName ? String(note.createdByName) : null,
    updatedBy: note.updatedBy ? Number(note.updatedBy) : null,
    updatedByName: note.updatedByName ? String(note.updatedByName) : null,
    createdAt: String(note.createdAt),
    updatedAt: String(note.updatedAt),
    linkedTasks: Number(note.linkedTasks ?? 0),
    revisions: Number(note.revisions ?? 0),
  }
}
