import { NextResponse } from "next/server"
import { badRequest, getUserId, serverError, getAuthenticatedUserId } from "@/lib/api-utils"
import { getAgentRunDetail } from "@/lib/multi-agent"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(request)
  const { id } = await params
  const runId = Number(id)

  if (!userId) {
    return badRequest("Missing user id")
  }

  if (!Number.isInteger(runId) || runId < 1) {
    return badRequest("Invalid run id")
  }

  try {
    const run = await getAgentRunDetail(userId, runId)

    if (!run) {
      return NextResponse.json({ error: "Agent run not found" }, { status: 404 })
    }

    return NextResponse.json({ run })
  } catch (error) {
    console.error("Fetch agent run failed:", error)
    return serverError("Could not load agent run")
  }
}
