import { NextResponse } from "next/server"
import { badRequest, getUserId, serverError, getAuthenticatedUserId } from "@/lib/api-utils"
import { createAgentRun, executeAgentRun, getAgentCatalog, getAgentRuns } from "@/lib/multi-agent"

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request)
  const { searchParams } = new URL(request.url)
  const workspaceId = Number(searchParams.get("workspaceId"))
  const parsedWorkspaceId = Number.isInteger(workspaceId) && workspaceId > 0 ? workspaceId : null

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const runs = await getAgentRuns(userId, parsedWorkspaceId)
    return NextResponse.json({
      agents: getAgentCatalog(),
      runs,
    })
  } catch (error) {
    console.error("Fetch agent runs failed:", error)
    return serverError("Could not load agent runs")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, workspaceId, goal } = await request.json()
    const parsedUserId = Number(userId) || (await getAuthenticatedUserId(request))
    const parsedWorkspaceId = Number.isInteger(Number(workspaceId)) && Number(workspaceId) > 0 ? Number(workspaceId) : null
    const runGoal = String(goal ?? "").trim()

    if (!parsedUserId || parsedUserId < 1) {
      return badRequest("Missing user id")
    }

    if (!runGoal) {
      return badRequest("Goal is required")
    }

    const runId = await createAgentRun({
      userId: parsedUserId,
      workspaceId: parsedWorkspaceId,
      goal: runGoal,
    })

    await executeAgentRun({
      runId,
      userId: parsedUserId,
      workspaceId: parsedWorkspaceId,
      goal: runGoal,
    })

    const runs = await getAgentRuns(parsedUserId, parsedWorkspaceId)
    const run = runs.find((item) => item.id === runId)

    return NextResponse.json({
      agents: getAgentCatalog(),
      run,
    })
  } catch (error) {
    console.error("Create agent run failed:", error)
    return serverError("Could not execute agent run")
  }
}
