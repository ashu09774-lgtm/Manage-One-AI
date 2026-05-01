import { getUserId, badRequest, serverError } from "@/lib/api-utils"
import { generateAssistantStream, getTemplateById, summarizeConversation } from "@/lib/ai"
import { db } from "@/lib/db"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

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

export async function POST(request: Request) {
  try {
    const userId = getUserId(request)
    if (!userId) return badRequest("Missing user id")

    const { content, templateId, workspaceId } = await request.json()
    if (!content?.trim()) return badRequest("Message is required")

    const conversationId = await getConversationId(userId)
    const template = await getTemplateById(userId, templateId)
    
    // Fetch previous messages for context/memory
    const [prevMessages] = await db.execute<RowDataPacket[]>(
      "SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 15",
      [conversationId]
    )

    let summary = null
    if (prevMessages.length >= 10) {
      summary = await summarizeConversation(prevMessages.reverse() as Array<{ role: string; content: string }>)
    }

    // Save user message
    await db.execute(
      "INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'user', ?)",
      [conversationId, content.trim()]
    )

    const stream = await generateAssistantStream({
      userId,
      conversationId,
      template,
      content: content.trim(),
      workspaceId: workspaceId ? Number(workspaceId) : null,
      summary,
    })

    if (!stream) {
      return serverError("Could not initialize AI stream")
    }

    // We'll use a TransformStream to:
    // 1. Pass data to the client
    // 2. Accumulate the full response to save to DB at the end
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    let fullResponse = ""

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk)
        
        // Gemini SSE format is "data: {...}\n\n"
        // We want to extract the text parts and send them cleanly to our frontend
        const lines = text.split("\n")
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              const part = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
              if (part) {
                fullResponse += part
                controller.enqueue(encoder.encode(part))
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      },
      async flush() {
        // Save the full response to DB once the stream is done
        try {
          await db.execute(
            "INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)",
            [conversationId, fullResponse]
          )
          await db.execute(
            "UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [conversationId]
          )
        } catch (error) {
          console.error("Failed to save streamed AI message:", error)
        }
      }
    })

    return new Response(stream.pipeThrough(transformStream), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  } catch (error) {
    console.error("AI Streaming error:", error)
    return serverError("AI service currently unavailable")
  }
}
