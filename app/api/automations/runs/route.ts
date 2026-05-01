import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserId, badRequest, serverError } from "@/lib/api-utils"
import type { RowDataPacket } from "mysql2"

export async function GET(request: Request) {
  try {
    const userId = getUserId(request)
    if (!userId) return badRequest("Missing user id")

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get("workspaceId")

    const filter = workspaceId ? "AND a.workspace_id = ?" : ""
    const params = workspaceId ? [userId, workspaceId] : [userId]

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
        ar.id,
        ar.automation_id AS automationId,
        ar.trigger_type AS triggerType,
        ar.status,
        ar.started_at AS startedAt,
        ar.finished_at AS finishedAt,
        ar.error_message AS errorMessage,
        a.name AS automationName
      FROM automation_runs ar
      INNER JOIN automations a ON a.id = ar.automation_id
      INNER JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ?
      WHERE 1=1 ${filter}
      ORDER BY ar.started_at DESC
      LIMIT 100`,
      params
    )

    return NextResponse.json({ runs: rows })
  } catch (error) {
    console.error("Failed to fetch automation runs:", error)
    return serverError("Could not fetch automation runs")
  }
}
