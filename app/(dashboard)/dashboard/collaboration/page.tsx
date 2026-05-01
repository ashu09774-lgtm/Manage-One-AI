"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Activity, MessageSquare, Radio, Save, Send, Users, Wifi, WifiOff } from "lucide-react"

interface UserData {
  id: string
  name?: string
}

interface WorkspaceOption {
  id: number
  name: string
}

interface CollaborationMessage {
  id: number
  body: string
  userId: number | null
  userName: string
  createdAt: string
}

interface CollaborationActivity {
  id: number
  actor: string
  action: string
  subject: string
  createdAt: string
}

interface CollaborationMember {
  id: number
  name: string
  email: string
  status: "online" | "away" | "offline"
  role: string
}

interface TypingUser {
  userId: number
  userName: string
  expiresAt: number
}

export default function CollaborationPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("")
  const [messages, setMessages] = useState<CollaborationMessage[]>([])
  const [activity, setActivity] = useState<CollaborationActivity[]>([])
  const [members, setMembers] = useState<CollaborationMember[]>([])
  const [sharedDoc, setSharedDoc] = useState("")
  const [sharedDocDirty, setSharedDocDirty] = useState(false)
  const [messageInput, setMessageInput] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected")
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptRef = useRef(0)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingEmitRef = useRef(0)

  // Load user from localStorage (set by dashboard layout from /api/auth/me)
  useEffect(() => {
    const storedUser = localStorage.getItem("manageone_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  // Load workspaces when user is available
  useEffect(() => {
    if (!user?.id) return
    void loadWorkspaces()
  }, [user])

  // Connect SSE and manage presence when workspace is selected
  const connectSSE = useCallback(() => {
    if (!user?.id || !selectedWorkspaceId) return

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setConnectionStatus("connecting")

    const eventSource = new EventSource(
      `/api/collaboration/stream?userId=${user.id}&workspaceId=${selectedWorkspaceId}`
    )
    eventSourceRef.current = eventSource

    eventSource.addEventListener("ready", () => {
      setConnectionStatus("connected")
      reconnectAttemptRef.current = 0
    })

    eventSource.addEventListener("workspace_message", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as CollaborationMessage
      setMessages((current) => [...current, payload])
    })

    eventSource.addEventListener("activity", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as Omit<CollaborationActivity, "id">
      setActivity((current) => [{ id: Date.now(), ...payload }, ...current].slice(0, 25))
    })

    eventSource.addEventListener("presence", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        userId: number
        status: CollaborationMember["status"]
      }
      setMembers((current) =>
        current.map((member) =>
          member.id === payload.userId ? { ...member, status: payload.status } : member
        )
      )
    })

    eventSource.addEventListener("shared_doc", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        content: string
        updatedBy: number
      }
      if (payload.updatedBy !== Number(user.id)) {
        setSharedDoc(payload.content)
        setSharedDocDirty(false)
      }
    })

    eventSource.addEventListener("typing", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        userId: number
        userName: string
      }
      if (payload.userId !== Number(user.id)) {
        setTypingUsers((current) => {
          const filtered = current.filter((t) => t.userId !== payload.userId)
          return [...filtered, { ...payload, expiresAt: Date.now() + 4000 }]
        })
      }
    })

    eventSource.onerror = () => {
      setConnectionStatus("disconnected")
      eventSource.close()
      eventSourceRef.current = null

      // Exponential backoff reconnection
      const attempt = reconnectAttemptRef.current
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
      reconnectAttemptRef.current = attempt + 1

      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE()
      }, delay)
    }
  }, [user, selectedWorkspaceId])

  useEffect(() => {
    if (!user?.id || !selectedWorkspaceId) return

    void loadWorkspaceState()
    connectSSE()

    const presenceInterval = window.setInterval(() => {
      void updatePresence("online")
    }, 25000)
    void updatePresence("online")

    return () => {
      window.clearInterval(presenceInterval)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      void updatePresence("away")
    }
  }, [user, selectedWorkspaceId, connectSSE])

  // Clean up expired typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((current) => current.filter((t) => t.expiresAt > Date.now()))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]")
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight
        }
      }
    })
  }, [messages])

  const onlineCount = useMemo(
    () => members.filter((member) => member.status === "online").length,
    [members]
  )

  const activeTypingUsers = useMemo(
    () => typingUsers.filter((t) => t.expiresAt > Date.now()),
    [typingUsers]
  )

  async function loadWorkspaces() {
    if (!user?.id) return
    const response = await fetch(`/api/workspaces?userId=${user.id}`)
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not load workspaces")
      return
    }

    const nextWorkspaces = data.workspaces.map((workspace: { id: number; name: string }) => ({
      id: workspace.id,
      name: workspace.name,
    }))
    setWorkspaces(nextWorkspaces)
    if (!selectedWorkspaceId && nextWorkspaces[0]) {
      setSelectedWorkspaceId(String(nextWorkspaces[0].id))
    }
  }

  async function loadWorkspaceState() {
    if (!user?.id || !selectedWorkspaceId) return

    setIsLoading(true)
    setError("")
    const response = await fetch(
      `/api/collaboration?userId=${user.id}&workspaceId=${selectedWorkspaceId}`
    )
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not load collaboration data")
      setIsLoading(false)
      return
    }

    setMessages(data.messages)
    setActivity(data.activity)
    setMembers(data.members)
    setSharedDoc(data.sharedDoc.content ?? "")
    setSharedDocDirty(false)
    setIsLoading(false)
  }

  async function sendMessage() {
    if (!user?.id || !selectedWorkspaceId || !messageInput.trim()) return

    const response = await fetch("/api/collaboration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        workspaceId: Number(selectedWorkspaceId),
        body: messageInput,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not send message")
      return
    }

    setMessageInput("")
  }

  async function saveSharedDoc() {
    if (!user?.id || !selectedWorkspaceId) return

    const response = await fetch("/api/collaboration/doc", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        workspaceId: Number(selectedWorkspaceId),
        content: sharedDoc,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not save shared brief")
      return
    }

    setSharedDocDirty(false)
  }

  async function updatePresence(status: "online" | "away" | "offline") {
    if (!user?.id || !selectedWorkspaceId) return
    try {
      await fetch("/api/collaboration/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          workspaceId: Number(selectedWorkspaceId),
          status,
        }),
      })
    } catch {
      // Silently fail presence updates — non-critical
    }
  }

  function emitTyping() {
    if (!user?.id || !selectedWorkspaceId) return

    const now = Date.now()
    // Throttle: only emit typing every 2 seconds
    if (now - lastTypingEmitRef.current < 2000) return
    lastTypingEmitRef.current = now

    void fetch("/api/collaboration/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        workspaceId: Number(selectedWorkspaceId),
      }),
    }).catch(() => {
      // Silently fail typing indicators — non-critical
    })
  }

  function handleMessageInputChange(value: string) {
    setMessageInput(value)
    emitTyping()
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collaboration</h1>
          <p className="text-muted-foreground">
            Live workspace chat, shared editing, activity feed, presence, and mention-aware updates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={String(workspace.id)}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline">
            <Radio className="mr-1 h-3 w-3" />
            {onlineCount} online
          </Badge>
          <Badge
            variant={connectionStatus === "connected" ? "default" : "secondary"}
            className={
              connectionStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : connectionStatus === "connecting"
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
            }
          >
            {connectionStatus === "connected" ? (
              <Wifi className="mr-1 h-3 w-3" />
            ) : (
              <WifiOff className="mr-1 h-3 w-3" />
            )}
            {connectionStatus === "connected"
              ? "Live"
              : connectionStatus === "connecting"
                ? "Connecting..."
                : "Offline"}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Messages" value={messages.length} icon={MessageSquare} />
        <MetricCard title="Members" value={members.length} icon={Users} />
        <MetricCard title="Online" value={onlineCount} icon={Radio} />
        <MetricCard title="Activity Items" value={activity.length} icon={Activity} />
      </div>

      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList>
          <TabsTrigger value="chat">Team Chat</TabsTrigger>
          <TabsTrigger value="doc">Shared Brief</TabsTrigger>
          <TabsTrigger value="activity">Activity & Presence</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <Card className="flex h-[680px] flex-col">
            <CardHeader className="border-b">
              <CardTitle>Workspace Chat</CardTitle>
              <CardDescription>
                Messages and mentions stream in live for everyone in the workspace.
              </CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                        <div className="space-y-2">
                          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                          <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <MessageSquare className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="mb-1 font-semibold">No messages yet</h3>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Start the conversation. Messages will appear here in real time for all
                      workspace members.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-start gap-3 ${String(message.userId ?? "") === user?.id ? "flex-row-reverse" : ""}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {message.userName
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${String(message.userId ?? "") === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                      >
                        <div className="text-xs opacity-70">{message.userName}</div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
                        <p className="mt-1 text-[11px] opacity-70">
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="border-t p-4">
              {activeTypingUsers.length > 0 && (
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex gap-0.5">
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </span>
                  {activeTypingUsers.length === 1
                    ? `${activeTypingUsers[0].userName} is typing...`
                    : activeTypingUsers.length === 2
                      ? `${activeTypingUsers[0].userName} and ${activeTypingUsers[1].userName} are typing...`
                      : `${activeTypingUsers[0].userName} and ${activeTypingUsers.length - 1} others are typing...`}
                </div>
              )}
              <div className="space-y-3">
                <Textarea
                  value={messageInput}
                  onChange={(event) => handleMessageInputChange(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write to the workspace. Mention teammates with @NameWithoutSpaces. Press Enter to send."
                  className="min-h-24"
                />
                <div className="flex justify-end">
                  <Button onClick={sendMessage} disabled={!messageInput.trim()}>
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="doc">
          <Card>
            <CardHeader>
              <CardTitle>Shared Workspace Brief</CardTitle>
              <CardDescription>
                A lightweight shared editor for the team&apos;s current plan, decisions, and handoff
                notes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Live Shared Content</Label>
                <Textarea
                  value={sharedDoc}
                  onChange={(event) => {
                    setSharedDoc(event.target.value)
                    setSharedDocDirty(true)
                  }}
                  className="min-h-[420px]"
                  placeholder="Capture decisions, blockers, meeting notes, and the latest shared plan here."
                />
              </div>
              <div className="flex justify-end gap-2">
                {sharedDocDirty && <Badge variant="secondary">Unsaved changes</Badge>}
                <Button onClick={saveSharedDoc}>
                  <Save className="h-4 w-4" />
                  Save Brief
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <div className="grid gap-6 xl:grid-cols-[0.7fr,1.3fr]">
            <Card>
              <CardHeader>
                <CardTitle>Presence</CardTitle>
                <CardDescription>
                  Workspace members and their current availability signal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members found.</p>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>
                              {member.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                              member.status === "online"
                                ? "bg-emerald-500"
                                : member.status === "away"
                                  ? "bg-amber-500"
                                  : "bg-muted-foreground/30"
                            }`}
                          />
                        </div>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.role}</div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          member.status === "online"
                            ? "default"
                            : member.status === "away"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {member.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Feed</CardTitle>
                <CardDescription>
                  Recent chat, tasks, workspace actions, and collaboration events in one stream.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">No recent activity yet</p>
                    <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">
                      Events will appear here as team members interact with the workspace.
                    </p>
                  </div>
                ) : (
                  activity.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border p-4">
                      <div className="text-sm">
                        <span className="font-medium">{item.actor}</span>{" "}
                        <span className="text-muted-foreground">{item.action}</span>{" "}
                        <span className="font-medium">{item.subject}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: number
  icon: React.ElementType
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

