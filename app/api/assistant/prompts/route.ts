import { NextResponse } from "next/server"
import { badRequest } from "@/lib/api-utils"
import { createPromptTemplate, getPromptTemplates } from "@/lib/ai"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = Number(searchParams.get("userId"))

  if (!Number.isInteger(userId) || userId < 1) {
    return badRequest("Missing user id")
  }

  const templates = await getPromptTemplates(userId)
  return NextResponse.json({ templates })
}

export async function POST(request: Request) {
  const { userId, name, category, systemPrompt, promptPrefix } = await request.json()
  const parsedUserId = Number(userId)
  const templateName = String(name ?? "").trim()
  const templateCategory = String(category ?? "").trim()
  const instructions = String(systemPrompt ?? "").trim()

  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return badRequest("Missing user id")
  }

  if (!templateName || !templateCategory || !instructions) {
    return badRequest("Name, category, and system prompt are required")
  }

  const template = await createPromptTemplate({
    userId: parsedUserId,
    name: templateName,
    category: templateCategory,
    systemPrompt: instructions,
    promptPrefix: String(promptPrefix ?? "").trim(),
  })

  return NextResponse.json({ template })
}
