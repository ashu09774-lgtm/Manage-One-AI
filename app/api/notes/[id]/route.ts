import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { emitWorkspaceEvent } from "@/lib/realtime"

type NoteDetailRow = RowDataPacket & {
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
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const noteId = Number(id)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!Number.isInteger(noteId) || noteId < 1 || !Number.isInteger(userId) || userId < 1) {
      return badRequest("Missing note or user id")
    }

    const note = await getNoteForUser(noteId, userId)
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    const [tasks] = await db.execute<RowDataPacket[]>(
      `SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate
      FROM note_task_links ntl
      INNER JOIN tasks t ON t.id = ntl.task_id
      WHERE ntl.note_id = ?
      ORDER BY t.updated_at DESC`,
      [noteId]
    )

    const [revisions] = await db.execute<RowDataPacket[]>(
      `SELECT
        nr.id,
        nr.title,
        nr.content,
        nr.edited_by AS editedBy,
        u.name AS editedByName,
        DATE_FORMAT(nr.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM note_revisions nr
      LEFT JOIN users u ON u.id = nr.edited_by
      WHERE nr.note_id = ?
      ORDER BY nr.created_at DESC, nr.id DESC
      LIMIT 20`,
      [noteId]
    )

    return NextResponse.json({
      note: {
        ...formatNote(note),
        tasks: tasks.map((task) => ({
          id: Number(task.id),
          title: String(task.title),
          status: String(task.status),
          priority: String(task.priority),
          dueDate: task.dueDate ? String(task.dueDate) : null,
        })),
        taskIds: tasks.map((task) => Number(task.id)),
        revisions: revisions.map((revision) => ({
          id: Number(revision.id),
          title: String(revision.title),
          content: String(revision.content),
          editedBy: revision.editedBy ? Number(revision.editedBy) : null,
          editedByName: revision.editedByName ? String(revision.editedByName) : null,
          createdAt: String(revision.createdAt),
        })),
      },
    })
  } catch (error) {
    console.error("Fetch note failed:", error)
    return serverError("Could not load note")
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const noteId = Number(id)
    const { userId, title, content, docType, projectId, taskIds } = await request.json()
    const actorId = Number(userId)

    if (!Number.isInteger(noteId) || noteId < 1 || !Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Invalid request")
    }

    const current = await getNoteForUser(noteId, actorId)
    if (!current) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    const nextTitle = String(title ?? current.title).trim() || current.title
    const nextContent = String(content ?? current.content)
    const nextDocType = docType === "documentation" ? "documentation" : docType === "note" ? "note" : current.docType
    const nextProjectId = projectId === undefined
      ? current.projectId
      : Number.isInteger(Number(projectId)) && Number(projectId) > 0
        ? Number(projectId)
        : null

    if (nextProjectId) {
      const [projectRows] = await db.execute<RowDataPacket[]>(
        "SELECT id FROM projects WHERE id = ? AND workspace_id = ? AND archived_at IS NULL LIMIT 1",
        [nextProjectId, current.workspaceId]
      )

      if (projectRows.length === 0) {
        return badRequest("Choose a valid project")
      }
    }

    const changed = nextTitle !== current.title || nextContent !== current.content

    await db.execute(
      `UPDATE notes
      SET title = ?, content = ?, doc_type = ?, project_id = ?, updated_by = ?
      WHERE id = ?`,
      [nextTitle, nextContent, nextDocType, nextProjectId, actorId, noteId]
    )

    if (Array.isArray(taskIds)) {
      await db.execute("DELETE FROM note_task_links WHERE note_id = ?", [noteId])
      await syncTaskLinks(noteId, current.workspaceId, taskIds)
    }

    if (changed) {
      await db.execute(
        `INSERT INTO note_revisions (note_id, title, content, edited_by)
        VALUES (?, ?, ?, ?)`,
        [noteId, nextTitle, nextContent, actorId]
      )
    }

    await db.execute(
      `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, 'updated', 'note', ?, JSON_OBJECT('title', ?, 'docType', ?))`,
      [current.workspaceId, actorId, noteId, nextTitle, nextDocType]
    )

    const [[user]] = await db.execute<RowDataPacket[]>(
      "SELECT name FROM users WHERE id = ? LIMIT 1",
      [actorId]
    )

    emitWorkspaceEvent(current.workspaceId, "note_updated", {
      id: noteId,
      title: nextTitle,
      content: nextContent,
      docType: nextDocType,
      projectId: nextProjectId,
      updatedBy: actorId,
      updatedByName: user ? String(user.name) : "You",
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      note: {
        id: noteId,
        title: nextTitle,
        content: nextContent,
        docType: nextDocType,
        projectId: nextProjectId,
      },
    })
  } catch (error) {
    console.error("Update note failed:", error)
    return serverError("Could not update note")
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const noteId = Number(id)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!Number.isInteger(noteId) || noteId < 1 || !Number.isInteger(userId) || userId < 1) {
      return badRequest("Missing note or user id")
    }

    const current = await getNoteForUser(noteId, userId)
    if (!current) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    await db.execute("DELETE FROM notes WHERE id = ?", [noteId])
    await db.execute(
      `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, 'deleted', 'note', ?, JSON_OBJECT('title', ?))`,
      [current.workspaceId, userId, noteId, current.title]
    )

    emitWorkspaceEvent(current.workspaceId, "note_updated", {
      id: noteId,
      title: current.title,
      action: "deleted",
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete note failed:", error)
    return serverError("Could not delete note")
  }
}

async function getNoteForUser(noteId: number, userId: number) {
  const [[note]] = await db.execute<NoteDetailRow[]>(
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
      DATE_FORMAT(n.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
    FROM notes n
    INNER JOIN workspaces w ON w.id = n.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = n.workspace_id AND wm.user_id = ?
    LEFT JOIN projects p ON p.id = n.project_id
    LEFT JOIN users creator ON creator.id = n.created_by
    LEFT JOIN users updater ON updater.id = n.updated_by
    WHERE n.id = ?
    LIMIT 1`,
    [userId, noteId]
  )

  return note ?? null
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

function formatNote(note: NoteDetailRow) {
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
  }
}
