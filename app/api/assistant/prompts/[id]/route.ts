import { NextResponse } from "next/server"
import { badRequest, serverError } from "@/lib/api-utils"
import { deletePromptTemplate, updatePromptTemplate } from "@/lib/ai"

function parseCustomTemplateId(value: string) {
  return value.startsWith("custom-") ? Number(value.replace("custom-", "")) : Number.NaN
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const templateId = parseCustomTemplateId(id)
    const { userId, name, category, systemPrompt, promptPrefix } = await request.json()
    const parsedUserId = Number(userId)

    if (!Number.isInteger(templateId) || templateId < 1) {
      return badRequest("Only custom templates can be updated")
    }

    if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
      return badRequest("Missing user id")
    }

    await updatePromptTemplate({
      userId: parsedUserId,
      templateId,
      name: String(name ?? "").trim(),
      category: String(category ?? "").trim(),
      systemPrompt: String(systemPrompt ?? "").trim(),
      promptPrefix: String(promptPrefix ?? "").trim(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Update prompt template failed:", error)
    return serverError("Could not update prompt template")
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const templateId = parseCustomTemplateId(id)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!Number.isInteger(templateId) || templateId < 1) {
      return badRequest("Only custom templates can be deleted")
    }

    if (!Number.isInteger(userId) || userId < 1) {
      return badRequest("Missing user id")
    }

    await deletePromptTemplate(userId, templateId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete prompt template failed:", error)
    return serverError("Could not delete prompt template")
  }
}
