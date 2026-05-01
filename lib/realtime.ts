type EventPayload = Record<string, unknown>

type Subscriber = {
  id: string
  userId: number
  workspaceId?: number | null
  controller: ReadableStreamDefaultController<string>
}

declare global {
  var manageOneRealtimeSubscribers: Map<string, Subscriber> | undefined
}

const subscribers = globalThis.manageOneRealtimeSubscribers ?? new Map<string, Subscriber>()

if (!globalThis.manageOneRealtimeSubscribers) {
  globalThis.manageOneRealtimeSubscribers = subscribers
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

      // Send a heartbeat every 25 seconds to keep the connection alive
      // and detect dead connections early
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(`: heartbeat ${Date.now()}\n\n`)
        } catch {
          clearInterval(heartbeatInterval)
          subscribers.delete(subscriberId)
        }
      }, 25000)

      // Store the interval ID so we can clean it up on cancel
      ;(controller as unknown as Record<string, unknown>).__heartbeatInterval = heartbeatInterval
    },
    cancel(controller) {
      const ctrl = controller as unknown as Record<string, unknown>
      if (ctrl?.__heartbeatInterval) {
        clearInterval(ctrl.__heartbeatInterval as ReturnType<typeof setInterval>)
      }
      subscribers.delete(subscriberId)
    },
  })

  return { subscriberId, stream }
}

export function removeRealtimeSubscriber(subscriberId: string) {
  subscribers.delete(subscriberId)
}

function safeSend(subscriber: Subscriber, message: string) {
  try {
    subscriber.controller.enqueue(message)
  } catch {
    // Subscriber is disconnected — remove it
    subscribers.delete(subscriber.id)
  }
}

export function emitWorkspaceEvent(workspaceId: number, event: string, data: EventPayload) {
  for (const subscriber of subscribers.values()) {
    if (subscriber.workspaceId === workspaceId) {
      safeSend(subscriber, formatSseEvent(event, data))
    }
  }
}

export function emitUserEvent(userId: number, event: string, data: EventPayload) {
  for (const subscriber of subscribers.values()) {
    if (subscriber.userId === userId) {
      safeSend(subscriber, formatSseEvent(event, data))
    }
  }
}

export function getSubscriberCount() {
  return subscribers.size
}

export function getWorkspaceSubscriberCount(workspaceId: number) {
  let count = 0
  for (const subscriber of subscribers.values()) {
    if (subscriber.workspaceId === workspaceId) count++
  }
  return count
}

