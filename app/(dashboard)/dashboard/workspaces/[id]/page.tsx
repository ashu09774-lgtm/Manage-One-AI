"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { KanbanBoard } from "@/components/tasks/kanban-board"
import { toast } from "sonner"
import { ArrowLeft, Bookmark, Calendar, FolderKanban, GripVertical, Mail, MessageSquare, Plus, Send, Settings, Shield, Trash2, UserCog, Users } from "lucide-react"

interface UserData {
  id: string
}

interface WorkspaceDetail {
  id: number
  name: string
  description: string | null
  color: string
  role: "owner" | "admin" | "member" | "viewer"
  tasks: number
  completedTasks: number
  members: number
  projects: number
}

interface WorkspaceTask {
  id: number
  workspaceId: number
  projectId: number | null
  title: string
  description: string | null
  status: "todo" | "in-progress" | "review" | "done"
  priority: "low" | "medium" | "high" | "urgent"
  assignee: string | null
  assigneeId: number | null
  dueDate: string | null
  comments: number
  attachments: number
}

interface WorkspaceMember {
  id: number
  name: string
  email: string
  role: "owner" | "admin" | "member" | "viewer"
  status: "online" | "away" | "offline"
  tasks: number
}

interface WorkspaceInvitation {
  id: number
  email: string
  role: "admin" | "member" | "viewer"
  invitedByName: string | null
  createdAt: string
}

interface WorkspaceProject {
  id: number
  name: string
  description: string | null
  color: string
  tasks: number
  completedTasks: number
  members: number
  startDate: string | null
  endDate: string | null
  progress: number
}

interface WorkspaceChat {
  id: number
  userId: number
  userName: string
  message: string
  createdAt: string
}

const columns = [
  { id: "todo", title: "To Do", color: "bg-muted-foreground" },
  { id: "in-progress", title: "In Progress", color: "bg-blue-500" },
  { id: "review", title: "In Review", color: "bg-yellow-500" },
  { id: "done", title: "Done", color: "bg-green-500" },
] as const

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-500",
  high: "bg-orange-500/10 text-orange-500",
  urgent: "bg-red-500/10 text-red-500",
}

const workspaceColors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"]

export default function WorkspaceDetailPage() {
  const params = useParams<{ id: string }>()
  const workspaceId = Number(params.id)
  const [user, setUser] = useState<UserData | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null)
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [projects, setProjects] = useState<WorkspaceProject[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [chats, setChats] = useState<WorkspaceChat[]>([])
  const [chatMessage, setChatMessage] = useState("")
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({})
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as WorkspaceTask["priority"],
    status: "todo" as WorkspaceTask["status"],
    assigneeId: "none",
    projectId: "none",
    dueDate: "",
  })
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    color: "bg-cyan-500",
  })
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "member" as WorkspaceInvitation["role"],
  })
  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    description: "",
    color: "bg-blue-500",
  })

  useEffect(() => {
    const storedUser = localStorage.getItem("manageone_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id || !workspaceId) return
    void loadWorkspace()
  }, [user, workspaceId])

  const groupedTasks = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.status === column.id),
    }))
  }, [tasks])

  const completionRate = workspace?.tasks ? Math.round((workspace.completedTasks / workspace.tasks) * 100) : 0
  const canManageWorkspace = workspace ? ["owner", "admin"].includes(workspace.role) : false

  async function loadWorkspace() {
    if (!user?.id) return

    setIsLoading(true)
    setError("")
    try {
      const [workspaceResponse, tasksResponse, membersResponse, projectsResponse] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}?userId=${user.id}`),
        fetch(`/api/tasks?userId=${user.id}&workspaceId=${workspaceId}`),
        fetch(`/api/workspaces/${workspaceId}/members?userId=${user.id}`),
        fetch(`/api/workspaces/${workspaceId}/projects?userId=${user.id}`),
      ])

      const workspaceData = await workspaceResponse.json()
      const tasksData = await tasksResponse.json()
      const membersData = await membersResponse.json()
      const projectsData = await projectsResponse.json()

      if (!workspaceResponse.ok) throw new Error(workspaceData.error)
      if (!tasksResponse.ok) throw new Error(tasksData.error)
      if (!membersResponse.ok) throw new Error(membersData.error)
      if (!projectsResponse.ok) throw new Error(projectsData.error)

      setWorkspace(workspaceData.workspace)
      setTasks(tasksData.tasks)
      setMembers(membersData.members)
      setInvitations(membersData.invitations ?? [])
      setProjects(projectsData.projects)
      setWorkspaceForm({
        name: workspaceData.workspace.name,
        description: workspaceData.workspace.description ?? "",
        color: workspaceData.workspace.color,
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load workspace")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.id || !workspaceId) return

    const eventSource = new EventSource(`/api/collaboration/stream?userId=${user.id}&workspaceId=${workspaceId}`)

    eventSource.addEventListener("chat_message", (event) => {
      const payload = JSON.parse((event as MessageEvent).data)
      setChats((current) => [...current, payload])
      if (payload.userId !== Number(user.id)) {
        toast.info(`New message from ${payload.userName}`)
      }
    })

    eventSource.addEventListener("typing", (event) => {
      const payload = JSON.parse((event as MessageEvent).data)
      if (payload.userId === Number(user.id)) return

      setTypingUsers((current) => ({
        ...current,
        [payload.userId]: payload.userName,
      }))

      setTimeout(() => {
        setTypingUsers((current) => {
          const next = { ...current }
          delete next[payload.userId]
          return next
        })
      }, 3000)
    })

    return () => eventSource.close()
  }, [user, workspaceId])

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chats])

  async function loadChats() {
    if (!user?.id) return
    const response = await fetch(`/api/workspaces/${workspaceId}/chat?userId=${user.id}`)
    const data = await response.json()
    if (response.ok) setChats(data.chats)
  }

  async function sendChatMessage() {
    if (!chatMessage.trim() || !user?.id || isSendingChat) return

    setIsSendingChat(true)
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, message: chatMessage.trim() }),
      })
      if (response.ok) setChatMessage("")
    } finally {
      setIsSendingChat(false)
    }
  }

  async function handleTyping() {
    if (!user?.id || !workspaceId) return
    void fetch("/api/collaboration/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, workspaceId }),
    })
  }

  async function handleAddTask() {
    if (!newTask.title.trim() || !user?.id) return

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        workspaceId,
        projectId: newTask.projectId === "none" ? null : Number(newTask.projectId),
        assigneeId: newTask.assigneeId === "none" ? null : Number(newTask.assigneeId),
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        status: newTask.status,
        dueDate: newTask.dueDate || null,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error ?? "Could not create task")
      setError(data.error ?? "Could not create task")
      return
    }

    toast.success("Task created successfully")

    const assigneeName = members.find((member) => member.id === data.task.assigneeId)?.name ?? null
    setTasks((current) => [{ ...data.task, assignee: assigneeName }, ...current])
    setWorkspace((current) => current ? { ...current, tasks: current.tasks + 1, completedTasks: current.completedTasks + (data.task.status === "done" ? 1 : 0) } : current)
    setNewTask({ title: "", description: "", priority: "medium", status: "todo", assigneeId: "none", projectId: "none", dueDate: "" })
    setDialogOpen(false)
    void refreshProjects()
  }

  async function handleTaskMove(taskId: string | number, newStatus: string, newIndex: number) {
    if (!user?.id) return
    const id = Number(taskId)
    
    const task = tasks.find(t => t.id === id)
    if (!task) return
    
    const oldStatus = task.status

    setTasks((current) => current.map((item) => item.id === id ? { ...item, status: newStatus as WorkspaceTask["status"] } : item))
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, status: newStatus }),
    })

    if (!response.ok) {
      await loadWorkspace()
      return
    }

    setWorkspace((current) => {
      if (!current) return current
      const delta = oldStatus !== "done" && newStatus === "done" ? 1 : oldStatus === "done" && newStatus !== "done" ? -1 : 0
      return { ...current, completedTasks: current.completedTasks + delta }
    })
    void refreshProjects()
  }

  async function handleCreateProject() {
    if (!user?.id || !newProject.name.trim()) return

    const response = await fetch(`/api/workspaces/${workspaceId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        name: newProject.name,
        description: newProject.description,
        color: newProject.color,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error ?? "Could not create project")
      setError(data.error ?? "Could not create project")
      return
    }

    toast.success("Project created successfully")

    setProjects((current) => [data.project, ...current])
    setWorkspace((current) => current ? { ...current, projects: current.projects + 1 } : current)
    setNewProject({ name: "", description: "", color: "bg-cyan-500" })
    setProjectDialogOpen(false)
  }

  async function handleInviteMember() {
    if (!user?.id || !inviteForm.email.trim()) return

    const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: inviteForm.email,
        role: inviteForm.role,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error ?? "Could not invite member")
      setError(data.error ?? "Could not invite member")
      return
    }
    
    toast.success("Invitation sent")

    if (data.member) {
      setMembers((current) => [...current, data.member])
      setWorkspace((current) => current ? { ...current, members: current.members + 1 } : current)
    }

    if (data.invitation) {
      setInvitations((current) => [data.invitation, ...current])
    }

    setInviteForm({ email: "", role: "member" })
  }

  async function updateMemberRole(memberId: number, role: WorkspaceMember["role"]) {
    if (!user?.id) return

    const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        role,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error ?? "Could not update member role")
      setError(data.error ?? "Could not update member role")
      return
    }

    toast.success("Member role updated")

    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role: data.role } : member))
  }

  async function removeMember(memberId: number) {
    if (!user?.id) return

    const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}?userId=${user.id}`, {
      method: "DELETE",
    })
    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error ?? "Could not remove member")
      setError(data.error ?? "Could not remove member")
      return
    }

    toast.success("Member removed")

    setMembers((current) => current.filter((member) => member.id !== memberId))
    setWorkspace((current) => current ? { ...current, members: Math.max(0, current.members - 1) } : current)
  }

  async function saveWorkspaceSettings() {
    if (!user?.id || !workspaceForm.name.trim()) return

    const response = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        name: workspaceForm.name,
        description: workspaceForm.description,
        color: workspaceForm.color,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error ?? "Could not save workspace settings")
      setError(data.error ?? "Could not save workspace settings")
      return
    }

    toast.success("Workspace settings saved")

    setWorkspace((current) => current ? { ...current, ...data.workspace } : current)
  }

  async function refreshProjects() {
    if (!user?.id) return
    const response = await fetch(`/api/workspaces/${workspaceId}/projects?userId=${user.id}`)
    const data = await response.json()
    if (!response.ok) return
    setProjects(data.projects)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/workspaces">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${workspace?.color ?? "bg-muted"}`}>
                <FolderKanban className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{workspace?.name ?? "Workspace"}</h1>
                <p className="text-muted-foreground">{workspace?.description || "Organize projects, share work, and track delivery."}</p>
              </div>
            </div>
            {workspace && (
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{workspace.role}</Badge>
                <span>{workspace.projects} projects</span>
                <span>{workspace.members} members</span>
                <span>{workspace.tasks} tasks</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={!canManageWorkspace}>
                <FolderKanban className="h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>Group related tasks inside this workspace.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Field label="Project Name">
                  <Input value={newProject.name} onChange={(event) => setNewProject((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <Field label="Description">
                  <Textarea value={newProject.description} onChange={(event) => setNewProject((current) => ({ ...current, description: event.target.value }))} />
                </Field>
                <Field label="Color">
                  <div className="flex flex-wrap gap-2">
                    {workspaceColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-8 w-8 rounded-full ${color} ${newProject.color === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                        onClick={() => setNewProject((current) => ({ ...current, color }))}
                      />
                    ))}
                  </div>
                </Field>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateProject}>Create Project</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Add Task</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>Add a task to this workspace and assign it right away.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Field label="Title">
                  <Input value={newTask.title} onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))} />
                </Field>
                <Field label="Description">
                  <RichTextEditor value={newTask.description} onChange={(value) => setNewTask((current) => ({ ...current, description: value }))} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Project">
                    <Select value={newTask.projectId} onValueChange={(value) => setNewTask((current) => ({ ...current, projectId: value }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Project</SelectItem>
                        {projects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Assignee">
                    <Select value={newTask.assigneeId} onValueChange={(value) => setNewTask((current) => ({ ...current, assigneeId: value }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {members.map((member) => <SelectItem key={member.id} value={String(member.id)}>{member.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Status">
                    <Select value={newTask.status} onValueChange={(value) => setNewTask((current) => ({ ...current, status: value as WorkspaceTask["status"] }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Priority">
                    <Select value={newTask.priority} onValueChange={(value) => setNewTask((current) => ({ ...current, priority: value as WorkspaceTask["priority"] }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Due Date">
                    <Input type="date" value={newTask.dueDate} onChange={(event) => setNewTask((current) => ({ ...current, dueDate: event.target.value }))} />
                  </Field>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddTask}>Create Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Projects" value={workspace?.projects ?? 0} />
        <MetricCard title="Members" value={workspace?.members ?? 0} />
        <MetricCard title="Tasks" value={workspace?.tasks ?? 0} />
        <MetricCard title="Completion" value={`${completionRate}%`} />
      </div>

      <Tabs defaultValue="board" className="space-y-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="chat" onClick={loadChats}>Chat</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <Card className="flex flex-col h-[600px]">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Workspace Chat
              </CardTitle>
              <CardDescription>Real-time collaboration with your team members in this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 relative">
              <ScrollArea className="h-full p-4" ref={chatScrollRef}>
                <div className="space-y-4">
                  {chats.length === 0 ? (
                    <div className="flex h-full items-center justify-center py-20 text-muted-foreground">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    chats.map((chat) => (
                      <div key={chat.id} className={`flex flex-col ${chat.userId === Number(user?.id) ? "items-end" : "items-start"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">{chat.userName}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={`rounded-2xl px-4 py-2 max-w-[80%] text-sm ${chat.userId === Number(user?.id) ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"}`}>
                          {chat.message.split(/(@\w+)/g).map((part, i) => 
                            part.startsWith("@") ? (
                              <span key={i} className="font-semibold underline">{part}</span>
                            ) : (
                              part
                            )
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              
              {Object.keys(typingUsers).length > 0 && (
                <div className="absolute bottom-2 left-4 text-[10px] text-muted-foreground animate-pulse">
                  {Object.values(typingUsers).join(", ")} {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
                </div>
              )}
            </CardContent>
            <div className="p-4 border-t bg-muted/30 relative">
              {showMentionDropdown && (
                <Card className="absolute bottom-full left-4 z-50 mb-2 w-48 shadow-xl">
                  <ScrollArea className="h-48">
                    <div className="p-1">
                      {members.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          onClick={() => {
                            const parts = chatMessage.split("@")
                            parts.pop()
                            setChatMessage(parts.join("@") + "@" + member.name.replace(/\s+/g, "") + " ")
                            setShowMentionDropdown(false)
                          }}
                        >
                          <Avatar className="h-5 w-5 text-[10px]">
                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{member.name}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </Card>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message... @ to mention"
                  value={chatMessage}
                  onChange={(e) => {
                    const val = e.target.value
                    setChatMessage(val)
                    handleTyping()
                    const lastChar = val[e.target.selectionStart ?? 0 - 1]
                    if (lastChar === "@") setShowMentionDropdown(true)
                    else if (!val.includes("@") || lastChar === " ") setShowMentionDropdown(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      sendChatMessage()
                    }
                  }}
                />
                <Button size="icon" onClick={sendChatMessage} disabled={!chatMessage.trim() || isSendingChat}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="board">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Progress</CardTitle>
                <CardDescription>Track delivery across the full workspace.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{workspace?.completedTasks ?? 0} of {workspace?.tasks ?? 0} tasks completed</span>
                    <span>{completionRate}%</span>
                  </div>
                  <Progress value={completionRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <ScrollArea className="pb-4">
              <KanbanBoard
                columns={columns}
                tasks={tasks}
                onTaskMove={handleTaskMove}
                renderColumnHeader={(column, taskCount) => (
                  <div className="flex items-center justify-between border-b border-border p-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${column.color}`} />
                      <h3 className="font-semibold">{column.title}</h3>
                      <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs">{taskCount}</Badge>
                    </div>
                  </div>
                )}
                renderTask={(task) => (
                  <Card className="cursor-grab border-border bg-card shadow-sm transition-all hover:shadow-md active:cursor-grabbing">
                    <CardContent className="p-3">
                      <div className="mb-2 flex items-start gap-2">
                        <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium leading-tight">{task.title}</p>
                          {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`text-xs ${priorityColors[task.priority]}`}>{task.priority}</Badge>
                        {task.projectId && <Badge variant="outline">{projects.find((project) => project.id === task.projectId)?.name ?? "Project"}</Badge>}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{task.assignee ?? "Unassigned"}</span>
                        {task.dueDate && <span>{task.dueDate}</span>}
                      </div>
                    </CardContent>
                  </Card>
                )}
              />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="projects">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {projects.length === 0 ? (
              <Card className="lg:col-span-2 xl:col-span-3">
                <CardContent className="p-6 text-muted-foreground">No projects yet. Create a project to organize your workspace into folders.</CardContent>
              </Card>
            ) : (
              projects.map((project) => (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg ${project.color}`} />
                      <div className="min-w-0">
                        <CardTitle className="truncate">{project.name}</CardTitle>
                        <CardDescription className="line-clamp-2">{project.description || "No description"}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-2" />
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{project.tasks} tasks</span>
                      <span>{project.members} assignees</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {project.startDate || project.endDate
                        ? `${project.startDate ?? "No start"} to ${project.endDate ?? "No end"}`
                        : "Timeline appears as tasks get due dates."}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <div className="space-y-4">
            {projects.length === 0 ? (
              <Card><CardContent className="p-6 text-muted-foreground">No projects available for a timeline yet.</CardContent></Card>
            ) : (
              projects.map((project) => (
                <Card key={project.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${project.color}`} />
                          <h3 className="font-semibold">{project.name}</h3>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{project.description || "No project description"}</p>
                      </div>
                      <Badge variant="secondary">{project.progress}% complete</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <TimelineMetric label="Start" value={project.startDate ?? "Not scheduled"} />
                      <TimelineMetric label="End" value={project.endDate ?? "Not scheduled"} />
                      <TimelineMetric label="Tasks" value={`${project.completedTasks}/${project.tasks} done`} />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="members">
          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Members</CardTitle>
                <CardDescription>Share this workspace and manage roles.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr,180px,auto]">
                  <Input placeholder="Invite by email" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} disabled={!canManageWorkspace} />
                  <Select value={inviteForm.role} onValueChange={(value) => setInviteForm((current) => ({ ...current, role: value as WorkspaceInvitation["role"] }))} disabled={!canManageWorkspace}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInviteMember} disabled={!canManageWorkspace}><Mail className="h-4 w-4" />Invite</Button>
                </div>

                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{member.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{member.tasks} active tasks</Badge>
                        <Badge variant="outline">{member.status}</Badge>
                        <Select value={member.role} onValueChange={(value) => updateMemberRole(member.id, value as WorkspaceMember["role"])} disabled={!canManageWorkspace || member.role === "owner"}>
                          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" disabled={!canManageWorkspace || member.role === "owner"} onClick={() => removeMember(member.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending Shares</CardTitle>
                <CardDescription>Invitations waiting to be accepted.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {invitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending invitations.</p>
                ) : (
                  invitations.map((invitation) => (
                    <div key={invitation.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{invitation.email}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(invitation.createdAt)}</p>
                        </div>
                        <Badge>{invitation.role}</Badge>
                      </div>
                    </div>
                  ))
                )}

                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Existing users are added to the workspace immediately. Unknown emails are stored as pending invitations in the database.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Settings</CardTitle>
              <CardDescription>Update naming, branding, and ownership controls for this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Workspace Name">
                  <Input value={workspaceForm.name} onChange={(event) => setWorkspaceForm((current) => ({ ...current, name: event.target.value }))} disabled={!canManageWorkspace} />
                </Field>
                <Field label="Description">
                  <Input value={workspaceForm.description} onChange={(event) => setWorkspaceForm((current) => ({ ...current, description: event.target.value }))} disabled={!canManageWorkspace} />
                </Field>
              </div>
              <Field label="Color">
                <div className="flex flex-wrap gap-2">
                  {workspaceColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-9 w-9 rounded-full ${color} ${workspaceForm.color === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                      disabled={!canManageWorkspace}
                      onClick={() => setWorkspaceForm((current) => ({ ...current, color }))}
                    />
                  ))}
                </div>
              </Field>
              <div className="grid gap-4 md:grid-cols-3">
                <InfoTile icon={Settings} label="Permission Model" value={workspace?.role ?? "member"} />
                <InfoTile icon={Users} label="Shared Members" value={String(workspace?.members ?? 0)} />
                <InfoTile icon={Shield} label="Manage Access" value={canManageWorkspace ? "Enabled" : "Read only"} />
              </div>
              <div className="flex justify-end">
                <Button onClick={saveWorkspaceSettings} disabled={!canManageWorkspace}>
                  <UserCog className="h-4 w-4" />
                  Save Workspace
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  )
}

function TimelineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  )
}

function InfoTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-2 font-medium">{value}</div>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], { month: "short", day: "numeric", year: "numeric" })
}


