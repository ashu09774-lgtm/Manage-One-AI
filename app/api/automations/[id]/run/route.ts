import { NextResponse } from "next/server"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { runAutomation } from "@/lib/automations"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const result = await runAutomation(userId, automationId)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Run automation failed:", error)
    return serverError(error instanceof Error ? error.message : "Could not execute automation")
  }
}
