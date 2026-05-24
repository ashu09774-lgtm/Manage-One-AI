import { NextResponse } from "next/server"
import { badRequest, getAuthenticatedUserId, serverError } from "@/lib/api-utils"
import { aiNativeActionTypes, executeAiNativeAction } from "@/lib/ai-task-actions"

export async function POST(request: Request) {
  try {
    const { userId, workspaceId, projectId, actionType, title, content, confirmed } = await request.json()
    const parsedUserId = Number(userId) || (await getAuthenticatedUserId(request))
    const parsedWorkspaceId = Number(workspaceId)
    const parsedProjectId = Number.isInteger(Number(projectId)) && Number(projectId) > 0 ? Number(projectId) : null
    const safeActionType = aiNativeActionTypes.find((item) => item === actionType)
    const actionContent = String(content ?? "").trim()

    if (!parsedUserId || parsedUserId < 1) {
      return badRequest("Missing user id")
    }

    if (!Number.isInteger(parsedWorkspaceId) || parsedWorkspaceId < 1) {
      return badRequest("Choose a workspace")
    }

    if (!safeActionType) {
      return badRequest("Unsupported AI action")
    }

    if (!actionContent) {
      return badRequest("Action content is required")
    }

    const result = await executeAiNativeAction({
      userId: parsedUserId,
      workspaceId: parsedWorkspaceId,
      projectId: parsedProjectId,
      actionType: safeActionType,
      title: typeof title === "string" ? title : undefined,
      content: actionContent,
      confirmed: confirmed === true,
    })

    return NextResponse.json({ result })
  } catch (error) {
    console.error("Execute AI native action failed:", error)
    return serverError(error instanceof Error ? error.message : "Could not execute AI action")
  }
}
