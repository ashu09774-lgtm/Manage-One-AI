import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

export async function GET(request: Request) {
  const userId = getUserId(request)

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const [[stats]] = await db.execute<RowDataPacket[]>(
      `SELECT
        COUNT(DISTINCT w.id) AS workspaces,
        COUNT(DISTINCT t.id) AS tasks,
        COUNT(DISTINCT wm2.user_id) AS members,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS completed
      FROM workspace_members wm
      LEFT JOIN workspaces w ON w.id = wm.workspace_id AND w.archived_at IS NULL
      LEFT JOIN workspace_members wm2 ON wm2.workspace_id = w.id
      LEFT JOIN tasks t ON t.workspace_id = w.id
      WHERE wm.user_id = ?`,
      [userId]
    )

    const [recentTasks] = await db.execute<RowDataPacket[]>(
      `SELECT t.id, t.title, t.status, t.priority, w.name AS workspace
      FROM tasks t
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      INNER JOIN workspaces w ON w.id = t.workspace_id
      ORDER BY t.updated_at DESC
      LIMIT 5`,
      [userId]
    )

    const [projects] = await db.execute<RowDataPacket[]>(
      `SELECT
        p.id,
        p.name,
        COUNT(DISTINCT t.id) AS tasks,
        COUNT(DISTINCT t.assignee_id) AS members,
        COALESCE(ROUND(COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) / NULLIF(COUNT(DISTINCT t.id), 0) * 100), 0) AS progress
      FROM projects p
      INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = ?
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.archived_at IS NULL
      GROUP BY p.id, p.name, p.updated_at
      ORDER BY p.updated_at DESC
      LIMIT 3`,
      [userId]
    )

    const [activity] = await db.execute<RowDataPacket[]>(
      `SELECT
        ae.id,
        COALESCE(u.name, 'System') AS user,
        ae.action,
        COALESCE(
          JSON_UNQUOTE(JSON_EXTRACT(ae.metadata, '$.title')),
          JSON_UNQUOTE(JSON_EXTRACT(ae.metadata, '$.name')),
          ae.entity_type
        ) AS subject,
        DATE_FORMAT(ae.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM activity_events ae
      INNER JOIN workspace_members wm ON wm.workspace_id = ae.workspace_id AND wm.user_id = ?
      LEFT JOIN users u ON u.id = ae.actor_id
      ORDER BY ae.created_at DESC
      LIMIT 5`,
      [userId]
    )

    const totalTasks = Number(stats?.tasks ?? 0)
    const completed = Number(stats?.completed ?? 0)

    return NextResponse.json({
      stats: {
        workspaces: Number(stats?.workspaces ?? 0),
        tasks: totalTasks,
        members: Number(stats?.members ?? 0),
        completionRate: totalTasks ? Math.round((completed / totalTasks) * 100) : 0,
      },
      recentTasks,
      projects,
      activity,
    })
  } catch (error) {
    console.error("Fetch dashboard failed:", error)
    return serverError("Could not load dashboard")
  }
}
