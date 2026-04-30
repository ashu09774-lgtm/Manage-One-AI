import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { generateAssistantReply, getPromptTemplates, getUsageSummary, getTemplateById } from "@/lib/ai"
import { db } from "@/lib/db"

async function getConversationId(userId: number) {
  const [existing] = await db.execute<RowDataPacket[]>(
    "SELECT id FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
    [userId]
  )

  if (existing[0]?.id) {
    return Number(existing[0].id)
  }

  const [result] = await db.execute<ResultSetHeader>(
    "INSERT INTO ai_conversations (user_id, title) VALUES (?, 'Workspace assistant')",
    [userId]
  )

  return result.insertId
}

export async function GET(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const workspaceIdParam = Number(searchParams.get("workspaceId"))

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const conversationId = await getConversationId(userId)
    const [messages] = await db.execute<RowDataPacket[]>(
      `SELECT id, role, content, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM ai_messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC, id ASC`,
      [conversationId]
    )

    const [workspaces] = await db.execute<RowDataPacket[]>(
      `SELECT w.id, w.name
      FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
      WHERE w.archived_at IS NULL
      ORDER BY w.updated_at DESC`,
      [userId]
    )

    const templates = await getPromptTemplates(userId)
    const usage = await getUsageSummary(userId)
    const provider = process.env.GEMINI_API_KEY ? "gemini" : "taskflow-local"

    return NextResponse.json({
      conversationId,
      workspaceId: Number.isInteger(workspaceIdParam) && workspaceIdParam > 0 ? workspaceIdParam : null,
      provider,
      templates,
      usage,
      workspaces: workspaces.map((workspace) => ({
        id: Number(workspace.id),
        name: String(workspace.name),
      })),
      messages,
    })
  } catch (error) {
    console.error("Fetch assistant messages failed:", error)
    return serverError("Could not load assistant messages")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, content, templateId, workspaceId } = await request.json()
    const parsedUserId = Number(userId)
    const message = String(content ?? "").trim()
    const parsedWorkspaceId = Number.isInteger(Number(workspaceId)) && Number(workspaceId) > 0 ? Number(workspaceId) : null

    if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
      return badRequest("Missing user id")
    }

    if (!message) {
      return badRequest("Message is required")
    }

    const conversationId = await getConversationId(parsedUserId)
    const template = await getTemplateById(parsedUserId, typeof templateId === "string" ? templateId : null)
    const connection = await db.getConnection()

    try {
      await connection.beginTransaction()
      const [userMessage] = await connection.execute<ResultSetHeader>(
        "INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'user', ?)",
        [conversationId, message]
      )
      const assistantReply = await generateAssistantReply({
        userId: parsedUserId,
        conversationId,
        template,
        content: message,
        workspaceId: parsedWorkspaceId,
      })
      const [assistantMessage] = await connection.execute<ResultSetHeader>(
        "INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)",
        [conversationId, assistantReply.reply]
      )
      await connection.execute("UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [conversationId])
      await connection.commit()

      return NextResponse.json({
        provider: assistantReply.provider,
        model: assistantReply.model,
        status: assistantReply.status,
        template: template.name,
        messages: [
          { id: userMessage.insertId, role: "user", content: message, createdAt: new Date().toISOString() },
          { id: assistantMessage.insertId, role: "assistant", content: assistantReply.reply, createdAt: new Date().toISOString() },
        ],
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Create assistant message failed:", error)
    return serverError("Could not save assistant message")
  }
}
