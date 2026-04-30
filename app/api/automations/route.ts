import { NextResponse } from "next/server"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { createAutomation, getAutomationRuns, getAutomations, getAutomationSuggestions } from "@/lib/automations"

export async function GET(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const workspaceId = Number(searchParams.get("workspaceId"))
  const parsedWorkspaceId = Number.isInteger(workspaceId) && workspaceId > 0 ? workspaceId : null

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const [automations, runs, suggestions] = await Promise.all([
      getAutomations(userId, parsedWorkspaceId),
      getAutomationRuns(userId, parsedWorkspaceId),
      parsedWorkspaceId ? getAutomationSuggestions(userId, parsedWorkspaceId) : Promise.resolve([]),
    ])

    return NextResponse.json({ automations, runs, suggestions })
  } catch (error) {
    console.error("Fetch automations failed:", error)
    return serverError(error instanceof Error ? error.message : "Could not load automations")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, workspaceId, name, description, triggerType, actionType, config, enabled } = await request.json()
    const parsedUserId = Number(userId)
    const parsedWorkspaceId = Number(workspaceId)

    if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
      return badRequest("Missing user id")
    }

    if (!Number.isInteger(parsedWorkspaceId) || parsedWorkspaceId < 1) {
      return badRequest("Choose a workspace")
    }

    const automation = await createAutomation({
      userId: parsedUserId,
      workspaceId: parsedWorkspaceId,
      name: String(name ?? "").trim(),
      description: String(description ?? "").trim() || undefined,
      triggerType,
      actionType,
      config: config ?? {},
      enabled,
    })

    return NextResponse.json({ automation })
  } catch (error) {
    console.error("Create automation failed:", error)
    return serverError(error instanceof Error ? error.message : "Could not create automation")
  }
}
