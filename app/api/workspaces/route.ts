import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

type WorkspaceRow = RowDataPacket & {
  id: number
  name: string
  description: string | null
  color: string
  tasks: number
  completedTasks: number
  members: number
  lastUpdated: string
}

const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"]

export async function GET(request: Request) {
  const userId = getUserId(request)

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const [workspaces] = await db.execute<WorkspaceRow[]>(
      `SELECT
        w.id,
        w.name,
        w.description,
        w.color,
        COUNT(DISTINCT t.id) AS tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS completedTasks,
        COUNT(DISTINCT wm2.user_id) AS members,
        DATE_FORMAT(w.updated_at, '%Y-%m-%d %H:%i:%s') AS lastUpdated
      FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
      LEFT JOIN workspace_members wm2 ON wm2.workspace_id = w.id
      LEFT JOIN tasks t ON t.workspace_id = w.id
      WHERE w.archived_at IS NULL
      GROUP BY w.id, w.name, w.description, w.color, w.updated_at
      ORDER BY w.updated_at DESC`,
      [userId]
    )

    return NextResponse.json({ workspaces })
  } catch (error) {
    console.error("Fetch workspaces failed:", error)
    return serverError("Could not load workspaces")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, name, description } = await request.json()
    const ownerId = Number(userId)
    const workspaceName = String(name ?? "").trim()
    const workspaceDescription = String(description ?? "").trim()

    if (!Number.isInteger(ownerId) || ownerId < 1) {
      return badRequest("Missing user id")
    }

    if (!workspaceName) {
      return badRequest("Workspace name is required")
    }

    const color = colors[Math.floor(Math.random() * colors.length)]
    const connection = await db.getConnection()

    try {
      await connection.beginTransaction()
      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO workspaces (owner_id, name, description, color) VALUES (?, ?, ?, ?)",
        [ownerId, workspaceName, workspaceDescription || null, color]
      )
      await connection.execute(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')",
        [result.insertId, ownerId]
      )
      await connection.execute(
        `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
        VALUES (?, 'workspace', 'Workspace created', ?, 'workspace', ?)`,
        [ownerId, `Workspace "${workspaceName}" is ready for your team.`, result.insertId]
      )
      await connection.execute(
        `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
        VALUES (?, ?, 'created', 'workspace', ?, JSON_OBJECT('name', ?))`,
        [result.insertId, ownerId, result.insertId, workspaceName]
      )
      await connection.commit()

      return NextResponse.json({
        workspace: {
          id: result.insertId,
          name: workspaceName,
          description: workspaceDescription || null,
          color,
          tasks: 0,
          completedTasks: 0,
          members: 1,
          lastUpdated: new Date().toISOString(),
        },
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Create workspace failed:", error)
    return serverError("Could not create workspace")
  }
}
