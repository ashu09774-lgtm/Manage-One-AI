import { badRequest, getUserId } from "@/lib/api-utils"
import { createRealtimeStream } from "@/lib/realtime"

export async function GET(request: Request) {
  const userId = getUserId(request)

  if (!userId) {
    return badRequest("Missing user id")
  }

  const { stream } = createRealtimeStream({ userId })

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
