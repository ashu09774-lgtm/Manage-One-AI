import { badRequest, getUserId } from "@/lib/api-utils"
import { createRealtimeStream } from "@/lib/realtime"

export async function GET(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const workspaceId = Number(searchParams.get("workspaceId"))

  if (!userId) {
    return badRequest("Missing user id")
  }

  if (!Number.isInteger(workspaceId) || workspaceId < 1) {
    return badRequest("Invalid workspace id")
  }

  const { stream } = createRealtimeStream({ userId, workspaceId })

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
