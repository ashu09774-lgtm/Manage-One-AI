import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { emitWorkspaceEvent } from "@/lib/realtime"

export async function POST(request: Request) {
  try {
    const { userId, workspaceId, status } = await request.json()
    const parsedUserId = Number(userId)
    const parsedWorkspaceId = Number(workspaceId)
    const nextStatus = ["online", "away", "offline"].includes(status) ? status : "online"

    if (!Number.isInteger(parsedUserId) || parsedUserId < 1 || !Number.isInteger(parsedWorkspaceId) || parsedWorkspaceId < 1) {
      return badRequest("Invalid request")
    }

    const [[membership]] = await db.execute<RowDataPacket[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [parsedWorkspaceId, parsedUserId]
    )

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    await db.execute("UPDATE users SET status = ? WHERE id = ?", [nextStatus, parsedUserId])

    const [[user]] = await db.execute<RowDataPacket[]>(
      "SELECT name FROM users WHERE id = ? LIMIT 1",
      [parsedUserId]
    )

    emitWorkspaceEvent(parsedWorkspaceId, "presence", {
      userId: parsedUserId,
      userName: user ? String((user as { name: string }).name) : "User",
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Update presence failed:", error)
    return serverError("Could not update presence")
  }
}
