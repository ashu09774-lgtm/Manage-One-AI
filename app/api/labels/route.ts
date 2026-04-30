import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

export async function GET(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const workspaceId = Number(searchParams.get("workspaceId"))

  if (!userId || !Number.isInteger(workspaceId) || workspaceId < 1) {
    return badRequest("Missing workspace or user id")
  }

  try {
    const [labels] = await db.execute<RowDataPacket[]>(
      `SELECT l.id, l.name, l.color
      FROM labels l
      INNER JOIN workspace_members wm ON wm.workspace_id = l.workspace_id AND wm.user_id = ?
      WHERE l.workspace_id = ?
      ORDER BY l.name`,
      [userId, workspaceId]
    )

    return NextResponse.json({ labels })
  } catch (error) {
    console.error("Fetch labels failed:", error)
    return serverError("Could not load labels")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, workspaceId, name, color } = await request.json()
    const parsedUserId = Number(userId)
    const parsedWorkspaceId = Number(workspaceId)
    const labelName = String(name ?? "").trim()
    const labelColor = String(color ?? "bg-blue-500").trim() || "bg-blue-500"

    if (!parsedUserId || !parsedWorkspaceId || !labelName) {
      return badRequest("Missing label data")
    }

    const [membership] = await db.execute<RowDataPacket[]>(
      "SELECT workspace_id FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [parsedWorkspaceId, parsedUserId]
    )

    if (membership.length === 0) {
      return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 })
    }

    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO labels (workspace_id, name, color) VALUES (?, ?, ?)",
      [parsedWorkspaceId, labelName, labelColor]
    )

    return NextResponse.json({
      label: {
        id: result.insertId,
        name: labelName,
        color: labelColor,
      },
    })
  } catch (error) {
    console.error("Create label failed:", error)
    return serverError("Could not create label")
  }
}
