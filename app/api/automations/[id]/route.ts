import { NextResponse } from "next/server"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { deleteAutomation, getAutomation, updateAutomation } from "@/lib/automations"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(request)
  const { id } = await params
  const automationId = Number(id)

  if (!userId) {
    return badRequest("Missing user id")
  }

  if (!Number.isInteger(automationId) || automationId < 1) {
    return badRequest("Invalid automation id")
  }

  try {
    const automation = await getAutomation(userId, automationId)
    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }
    return NextResponse.json({ automation })
  } catch (error) {
    console.error("Fetch automation failed:", error)
    return serverError("Could not load automation")
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const automationId = Number(id)
    const { userId, name, description, triggerType, actionType, config, enabled } = await request.json()
    const parsedUserId = Number(userId)

    if (!Number.isInteger(automationId) || automationId < 1) {
      return badRequest("Invalid automation id")
    }

    if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
      return badRequest("Missing user id")
    }

    const automation = await updateAutomation({
      userId: parsedUserId,
      automationId,
      name: String(name ?? "").trim(),
      description: String(description ?? "").trim() || undefined,
      triggerType,
      actionType,
      config: config ?? {},
      enabled: Boolean(enabled),
    })

    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }

    return NextResponse.json({ automation })
  } catch (error) {
    console.error("Update automation failed:", error)
    return serverError(error instanceof Error ? error.message : "Could not update automation")
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(request)
  const { id } = await params
  const automationId = Number(id)

  if (!userId) {
    return badRequest("Missing user id")
  }

  if (!Number.isInteger(automationId) || automationId < 1) {
    return badRequest("Invalid automation id")
  }

  try {
    const deleted = await deleteAutomation(userId, automationId)
    if (!deleted) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete automation failed:", error)
    return serverError(error instanceof Error ? error.message : "Could not delete automation")
  }
}
