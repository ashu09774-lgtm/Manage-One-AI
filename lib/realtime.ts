type EventPayload = Record<string, unknown>

type Subscriber = {
  id: string
  userId: number
  workspaceId?: number | null
  controller: ReadableStreamDefaultController<string>
}

declare global {
  var taskflowRealtimeSubscribers: Map<string, Subscriber> | undefined
}

const subscribers = globalThis.taskflowRealtimeSubscribers ?? new Map<string, Subscriber>()

if (!globalThis.taskflowRealtimeSubscribers) {
  globalThis.taskflowRealtimeSubscribers = subscribers
}

function formatSseEvent(event: string, data: EventPayload) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function createRealtimeStream(input: { userId: number; workspaceId?: number | null }) {
  const subscriberId = crypto.randomUUID()

  const stream = new ReadableStream<string>({
    start(controller) {
      subscribers.set(subscriberId, {
        id: subscriberId,
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        controller,
      })

      controller.enqueue(formatSseEvent("ready", { subscriberId }))
    },
    cancel() {
      subscribers.delete(subscriberId)
    },
  })

  return { subscriberId, stream }
}

export function removeRealtimeSubscriber(subscriberId: string) {
  subscribers.delete(subscriberId)
}

export function emitWorkspaceEvent(workspaceId: number, event: string, data: EventPayload) {
  for (const subscriber of subscribers.values()) {
    if (subscriber.workspaceId === workspaceId) {
      subscriber.controller.enqueue(formatSseEvent(event, data))
    }
  }
}

export function emitUserEvent(userId: number, event: string, data: EventPayload) {
  for (const subscriber of subscribers.values()) {
    if (subscriber.userId === userId) {
      subscriber.controller.enqueue(formatSseEvent(event, data))
    }
  }
}
