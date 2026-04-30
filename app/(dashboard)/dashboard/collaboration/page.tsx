"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { Activity, MessageSquare, Radio, Save, Send, Users } from "lucide-react"

interface UserData {
  id: string
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
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem("taskflow_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void loadWorkspaces()
  }, [user])

  useEffect(() => {
    if (!user?.id || !selectedWorkspaceId) return
    void loadWorkspaceState()

    const eventSource = new EventSource(`/api/collaboration/stream?userId=${user.id}&workspaceId=${selectedWorkspaceId}`)
    eventSource.addEventListener("workspace_message", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as CollaborationMessage
      setMessages((current) => [...current, payload])
    })
    eventSource.addEventListener("activity", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as Omit<CollaborationActivity, "id">
      setActivity((current) => [{ id: Date.now(), ...payload }, ...current].slice(0, 25))
    })
    eventSource.addEventListener("presence", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { userId: number; status: CollaborationMember["status"] }
      setMembers((current) => current.map((member) => member.id === payload.userId ? { ...member, status: payload.status } : member))
    })
    eventSource.addEventListener("shared_doc", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { content: string; updatedBy: number }
      if (payload.updatedBy !== Number(user.id)) {
        setSharedDoc(payload.content)
        setSharedDocDirty(false)
      }
    })

    const presenceInterval = window.setInterval(() => {
      void updatePresence("online")
    }, 25000)
    void updatePresence("online")

    return () => {
      window.clearInterval(presenceInterval)
      eventSource.close()
      void updatePresence("away")
    }
  }, [user, selectedWorkspaceId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const onlineCount = useMemo(() => members.filter((member) => member.status === "online").length, [members])

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
    const response = await fetch(`/api/collaboration?userId=${user.id}&workspaceId=${selectedWorkspaceId}`)
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
    await fetch("/api/collaboration/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        workspaceId: Number(selectedWorkspaceId),
        status,
      }),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collaboration</h1>
          <p className="text-muted-foreground">Live workspace chat, shared editing, activity feed, presence, and mention-aware updates.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select workspace" /></SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="outline">
            <Radio className="mr-1 h-3 w-3" />
            {onlineCount} online
          </Badge>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

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
              <CardDescription>Messages and mentions stream in live for everyone in the workspace.</CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading chat...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={`flex items-start gap-3 ${String(message.userId ?? "") === user?.id ? "flex-row-reverse" : ""}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{message.userName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[80%] rounded-lg p-3 ${String(message.userId ?? "") === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <div className="text-xs opacity-70">{message.userName}</div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
                        <p className="mt-1 text-[11px] opacity-70">{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="border-t p-4">
              <div className="space-y-3">
                <Textarea
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder="Write to the workspace. Mention teammates with @NameWithoutSpaces."
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
              <CardDescription>A lightweight shared editor for the team’s current plan, decisions, and handoff notes.</CardDescription>
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
                <CardDescription>Workspace members and their current availability signal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{member.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.role}</div>
                      </div>
                    </div>
                    <Badge variant={member.status === "online" ? "default" : member.status === "away" ? "secondary" : "outline"}>
                      {member.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Feed</CardTitle>
                <CardDescription>Recent chat, tasks, workspace actions, and collaboration events in one stream.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity yet.</p>
                ) : (
                  activity.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border p-4">
                      <div className="text-sm">
                        <span className="font-medium">{item.actor}</span>{" "}
                        <span className="text-muted-foreground">{item.action}</span>{" "}
                        <span className="font-medium">{item.subject}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</div>
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

function MetricCard({ title, value, icon: Icon }: { title: string; value: number; icon: React.ElementType }) {
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
