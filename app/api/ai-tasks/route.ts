import { NextResponse } from "next/server"
import { badRequest, getAuthenticatedUserId, serverError } from "@/lib/api-utils"
import { completeAiTaskGroup, createAiTaskPlan, getAiTaskGroups, previewAiTaskPlan } from "@/lib/ai-task-orchestrator"
import { rateLimiter } from "@/lib/rate-limit"

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request)
  const { searchParams } = new URL(request.url)
  const workspaceId = Number(searchParams.get("workspaceId"))

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const groups = await getAiTaskGroups(
      userId,
      Number.isInteger(workspaceId) && workspaceId > 0 ? workspaceId : null
    )
    return NextResponse.json({ groups })
  } catch (error) {
    console.error("Fetch AI task groups failed:", error)
    return serverError("Could not load AI task groups")
  }
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = rateLimiter.limit(`ai-tasks:${ip}`, { limit: 8, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many AI task requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

    const { userId, workspaceId, projectId, goal, dueDateStyle, includeSubtasks, action, tasks, confirmed } = await request.json()
    const parsedUserId = Number(userId) || (await getAuthenticatedUserId(request))
    const parsedWorkspaceId = Number.isInteger(Number(workspaceId)) && Number(workspaceId) > 0 ? Number(workspaceId) : null
    const parsedProjectId = Number.isInteger(Number(projectId)) && Number(projectId) > 0 ? Number(projectId) : null
    const taskGoal = String(goal ?? "").trim()

    if (!parsedUserId || parsedUserId < 1) {
      return badRequest("Missing user id")
    }

    if (!taskGoal) {
      return badRequest("Goal is required")
    }

    const input = {
      userId: parsedUserId,
      workspaceId: parsedWorkspaceId,
      projectId: parsedProjectId,
      goal: taskGoal,
      dueDateStyle: ["none", "flexible", "this-week"].includes(dueDateStyle) ? dueDateStyle as "none" | "flexible" | "this-week" : "flexible",
      includeSubtasks: includeSubtasks !== false,
    }

    if (action === "preview") {
      const preview = await previewAiTaskPlan(input)
      return NextResponse.json({ preview })
    }

    const plan = await createAiTaskPlan({
      ...input,
      tasks: Array.isArray(tasks) ? tasks : undefined,
      confirmed: confirmed === true,
    })

    return NextResponse.json({ plan })
  } catch (error) {
    console.error("Create AI task plan failed:", error)
    return serverError(error instanceof Error ? error.message : "Could not create AI task plan")
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, runId, action } = await request.json()
    const parsedUserId = Number(userId) || (await getAuthenticatedUserId(request))
    const parsedRunId = Number(runId)

    if (!parsedUserId || parsedUserId < 1) {
      return badRequest("Missing user id")
    }

    if (!Number.isInteger(parsedRunId) || parsedRunId < 1) {
      return badRequest("Missing AI task group")
    }

    if (action !== "complete") {
      return badRequest("Unsupported action")
    }

    const result = await completeAiTaskGroup({ userId: parsedUserId, runId: parsedRunId })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Update AI task group failed:", error)
    return serverError(error instanceof Error ? error.message : "Could not update AI task group")
  }
}
