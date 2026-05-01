import { NextResponse } from "next/server"
import { badRequest, getUserId } from "@/lib/api-utils"
import { emitWorkspaceEvent } from "@/lib/realtime"
import { db } from "@/lib/db"
import type { RowDataPacket } from "mysql2"

export async function POST(request: Request) {
  try {
    const userId = getUserId(request)
    const { workspaceId, noteId, status } = await request.json()

    if (!userId || !workspaceId || !noteId) {
      return badRequest("Missing required parameters")
    }

    const [userRows] = await db.execute<RowDataPacket[]>(
      "SELECT name FROM users WHERE id = ?",
      [userId]
    )
    const userName = userRows[0]?.name || "Unknown user"

    emitWorkspaceEvent(Number(workspaceId), "note_presence", {
      userId,
      userName,
      noteId: Number(noteId),
      status, // "viewing", "editing", "left"
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Note presence failed:", error)
    return NextResponse.json({ error: "Could not send presence" }, { status: 500 })
  }
}
