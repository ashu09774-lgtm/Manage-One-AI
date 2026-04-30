import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { emitWorkspaceEvent } from "@/lib/realtime"

export async function PATCH(request: Request) {
  try {
    const { userId, workspaceId, content } = await request.json()
    const actorId = Number(userId)
    const parsedWorkspaceId = Number(workspaceId)
    const docContent = String(content ?? "")

    if (!Number.isInteger(actorId) || actorId < 1 || !Number.isInteger(parsedWorkspaceId) || parsedWorkspaceId < 1) {
      return badRequest("Invalid request")
    }

    const [[membership]] = await db.execute<RowDataPacket[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [parsedWorkspaceId, actorId]
    )

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    await db.execute<ResultSetHeader>(
      `INSERT INTO workspace_shared_docs (workspace_id, content, updated_by)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        content = VALUES(content),
        updated_by = VALUES(updated_by)`,
      [parsedWorkspaceId, docContent, actorId]
    )

    const [[user]] = await db.execute<RowDataPacket[]>(
      "SELECT name FROM users WHERE id = ? LIMIT 1",
      [actorId]
    )

    emitWorkspaceEvent(parsedWorkspaceId, "shared_doc", {
      content: docContent,
      updatedBy: actorId,
      updatedByName: user ? String(user.name) : "You",
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Update shared doc failed:", error)
    return serverError("Could not update shared document")
  }
}
