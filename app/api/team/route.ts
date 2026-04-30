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
    const [members] = await db.execute<RowDataPacket[]>(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.status,
        MIN(wm.role) AS role,
        COUNT(DISTINCT t.id) AS tasks
      FROM workspace_members my_memberships
      INNER JOIN workspace_members wm ON wm.workspace_id = my_memberships.workspace_id
      INNER JOIN users u ON u.id = wm.user_id
      LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status <> 'done'
      WHERE my_memberships.user_id = ?
      GROUP BY u.id, u.name, u.email, u.status
      ORDER BY u.name`,
      [userId]
    )

    return NextResponse.json({ members })
  } catch (error) {
    console.error("Fetch team failed:", error)
    return serverError("Could not load team")
  }
}
