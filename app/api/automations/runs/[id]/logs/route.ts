import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserId, badRequest, serverError } from "@/lib/api-utils"
import type { RowDataPacket } from "mysql2"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getUserId(request)
    if (!userId) return badRequest("Missing user id")

    const runId = Number(params.id)
    if (isNaN(runId)) return badRequest("Invalid run id")

    // Verify access via automation membership
    const [access] = await db.execute<RowDataPacket[]>(
      `SELECT ar.id
       FROM automation_runs ar
       INNER JOIN automations a ON a.id = ar.automation_id
       INNER JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ?
       WHERE ar.id = ?`,
      [userId, runId]
    )

    if (!access[0]) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
        id,
        run_id AS runId,
        node_id AS nodeId,
        node_type AS nodeType,
        status,
        input_data AS inputData,
        output_data AS outputData,
        error_details AS errorDetails,
        created_at AS createdAt
      FROM automation_logs
      WHERE run_id = ?
      ORDER BY created_at ASC`,
      [runId]
    )

    return NextResponse.json({ logs: rows })
  } catch (error) {
    console.error("Failed to fetch automation logs:", error)
    return serverError("Could not fetch automation logs")
  }
}
