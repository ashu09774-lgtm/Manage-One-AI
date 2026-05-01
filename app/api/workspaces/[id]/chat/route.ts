import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { badRequest, serverError, getUserId } from "@/lib/api-utils"
import { emitWorkspaceEvent } from "@/lib/realtime"
import type { RowDataPacket, ResultSetHeader } from "mysql2"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = Number(id)
    const userId = getUserId(request)

    if (!workspaceId || !userId) {
      return badRequest("Missing required parameters")
    }

    const [chats] = await db.execute<RowDataPacket[]>(
      `SELECT
        c.id,
        c.user_id AS userId,
        u.name AS userName,
        c.message,
        DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM workspace_chats c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.workspace_id = ?
      ORDER BY c.created_at ASC
      LIMIT 100`,
      [workspaceId]
    )

    return NextResponse.json({
      chats: chats.map((chat) => ({
        id: Number(chat.id),
        userId: Number(chat.userId),
        userName: String(chat.userName),
        message: String(chat.message),
        createdAt: String(chat.createdAt),
      })),
    })
  } catch (error) {
    console.error("Fetch workspace chats failed:", error)
    return serverError("Could not load chats")
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = Number(id)
    const userId = getUserId(request)

    if (!workspaceId || !userId) {
      return badRequest("Missing required parameters")
    }

    const { message } = await request.json()

    if (!message?.trim()) {
      return badRequest("Message cannot be empty")
    }

    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO workspace_chats (workspace_id, user_id, message) VALUES (?, ?, ?)",
      [workspaceId, userId, message.trim()]
    )

    // Fetch user name for the real-time event
    const [userRows] = await db.execute<RowDataPacket[]>(
      "SELECT name FROM users WHERE id = ?",
      [userId]
    )
    const userName = userRows[0]?.name || "Unknown user"

    const newMessage = {
      id: result.insertId,
      userId,
      userName,
      message: message.trim(),
      createdAt: new Date().toISOString(),
    }

    // Emit real-time event
    emitWorkspaceEvent(workspaceId, "chat_message", newMessage)

    return NextResponse.json({ chat: newMessage })
  } catch (error) {
    console.error("Post workspace chat failed:", error)
    return serverError("Could not send message")
  }
}
