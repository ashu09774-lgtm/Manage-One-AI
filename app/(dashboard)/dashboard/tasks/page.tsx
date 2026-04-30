"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, CheckSquare, Filter, List, MessageSquare, MoreHorizontal, Paperclip, Plus, Search, Tag, Trash2 } from "lucide-react"

interface UserData {
  id: string
}

interface Workspace {
  id: number
  name: string
}

interface WorkspaceMember {
  id: number
  name: string
  email: string
  role: "owner" | "admin" | "member" | "viewer"
}

interface WorkspaceProject {
  id: number
  name: string
  description: string | null
}

interface TaskLabel {
  id: number
  name: string
  color: string
}

interface Subtask {
  id?: number
  title: string
  completed: boolean
}

interface Task {
  id: number
  workspaceId: number
  workspace: string
  projectId: number | null
  title: string
  description: string | null
  status: "todo" | "in-progress" | "review" | "done"
  priority: "low" | "medium" | "high" | "urgent"
  assignee: string | null
  assigneeId?: number | null
  dueDate: string | null
  labels: TaskLabel[]
  subtasksTotal: number
  subtasksCompleted: number
}

interface TaskDetail extends Task {
  subtasks: Subtask[]
  comments: TaskComment[]
  attachments: TaskAttachment[]
}

interface TaskComment {
  id: number
  body: string
  userId: number | null
  userName: string | null
  createdAt: string
}

interface TaskAttachment {
  id: number
  fileName: string
  fileUrl: string
  fileSizeBytes: number | null
  mimeType: string | null
  uploadedBy: number | null
  uploadedByName: string | null
  createdAt: string
}

const columns = [
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "review", title: "In Review" },
  { id: "done", title: "Done" },
] as const

const statusColors = {
  "todo": "bg-muted text-muted-foreground",
  "in-progress": "bg-blue-500/10 text-blue-500",
  "review": "bg-yellow-500/10 text-yellow-500",
  "done": "bg-green-500/10 text-green-500",
}

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-500",
  high: "bg-orange-500/10 text-orange-500",
  urgent: "bg-red-500/10 text-red-500",
}

const labelColors = ["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"]

export default function TasksPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [labelsByWorkspace, setLabelsByWorkspace] = useState<Record<number, TaskLabel[]>>({})
  const [membersByWorkspace, setMembersByWorkspace] = useState<Record<number, WorkspaceMember[]>>({})
  const [projectsByWorkspace, setProjectsByWorkspace] = useState<Record<number, WorkspaceProject[]>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [view, setView] = useState("list")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null)
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState("")
  const [newCommentBody, setNewCommentBody] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    workspaceId: "",
    projectId: "none",
    assigneeId: "me",
    priority: "medium",
    dueDate: "",
    status: "todo",
    labelIds: [] as number[],
  })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem("taskflow_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void loadData(user.id)
  }, [user])

  useEffect(() => {
    if (!user?.id || !newTask.workspaceId) return
    const workspaceId = Number(newTask.workspaceId)
    if (!labelsByWorkspace[workspaceId]) void loadLabels(workspaceId, user.id)
    if (!membersByWorkspace[workspaceId]) void loadMembers(workspaceId, user.id)
    if (!projectsByWorkspace[workspaceId]) void loadProjects(workspaceId, user.id)
  }, [newTask.workspaceId, user, labelsByWorkspace, membersByWorkspace, projectsByWorkspace])

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.workspace.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.labels.some((label) => label.name.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  const groupedTasks = columns.map((column) => ({
    ...column,
    tasks: filteredTasks.filter((task) => task.status === column.id),
  }))

  const stats = {
    total: tasks.length,
    completed: tasks.filter((task) => task.status === "done").length,
    inProgress: tasks.filter((task) => task.status === "in-progress").length,
    overdue: tasks.filter((task) => task.dueDate && task.status !== "done" && new Date(task.dueDate) < new Date()).length,
  }

  const calendarGroups = groupByDueDate(filteredTasks)

  async function loadData(userId: string) {
    setIsLoading(true)
    setError("")
    try {
      const [tasksResponse, workspacesResponse] = await Promise.all([
        fetch(`/api/tasks?userId=${userId}`),
        fetch(`/api/workspaces?userId=${userId}`),
      ])
      const tasksData = await tasksResponse.json()
      const workspacesData = await workspacesResponse.json()
      if (!tasksResponse.ok) throw new Error(tasksData.error)
      if (!workspacesResponse.ok) throw new Error(workspacesData.error)
      setTasks(tasksData.tasks)
      setWorkspaces(workspacesData.workspaces)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load tasks")
    } finally {
      setIsLoading(false)
    }
  }

  async function loadLabels(workspaceId: number, userId: string) {
    const response = await fetch(`/api/labels?userId=${userId}&workspaceId=${workspaceId}`)
    const data = await response.json()
    if (!response.ok) return
    setLabelsByWorkspace((current) => ({ ...current, [workspaceId]: data.labels }))
  }

  async function loadMembers(workspaceId: number, userId: string) {
    const response = await fetch(`/api/workspaces/${workspaceId}/members?userId=${userId}`)
    const data = await response.json()
    if (!response.ok) return
    setMembersByWorkspace((current) => ({ ...current, [workspaceId]: data.members }))
  }

  async function loadProjects(workspaceId: number, userId: string) {
    const response = await fetch(`/api/workspaces/${workspaceId}/projects?userId=${userId}`)
    const data = await response.json()
    if (!response.ok) return
    setProjectsByWorkspace((current) => ({ ...current, [workspaceId]: data.projects }))
  }

  async function toggleTaskComplete(task: Task) {
    if (!user?.id) return
    const completed = task.status !== "done"
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: completed ? "done" : "todo" } : item))
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, completed }),
    })
  }

  async function handleCreateTask() {
    if (!user?.id) return

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        ...newTask,
        workspaceId: Number(newTask.workspaceId),
        projectId: newTask.projectId === "none" ? null : Number(newTask.projectId),
        assigneeId: newTask.assigneeId === "me" ? Number(user.id) : Number(newTask.assigneeId),
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not create task")
      return
    }

    const workspace = workspaces.find((item) => item.id === Number(newTask.workspaceId))
    const labels = (labelsByWorkspace[Number(newTask.workspaceId)] ?? []).filter((label) => newTask.labelIds.includes(label.id))
    const members = membersByWorkspace[Number(newTask.workspaceId)] ?? []
    const assigneeName = newTask.assigneeId === "me"
      ? "You"
      : members.find((member) => member.id === Number(newTask.assigneeId))?.name ?? "Unassigned"
    setTasks((current) => [{ ...data.task, workspace: workspace?.name ?? "Workspace", assignee: assigneeName, labels }, ...current])
    setNewTask({ title: "", description: "", workspaceId: "", projectId: "none", assigneeId: "me", priority: "medium", dueDate: "", status: "todo", labelIds: [] })
    setDialogOpen(false)
  }

  async function openTaskDetail(taskId: number) {
    if (!user?.id) return
    const response = await fetch(`/api/tasks/${taskId}?userId=${user.id}`)
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not load task")
      return
    }
    await loadLabels(Number(data.task.workspaceId), user.id)
    await loadMembers(Number(data.task.workspaceId), user.id)
    await loadProjects(Number(data.task.workspaceId), user.id)
    setSelectedTask({
      ...data.task,
      labels: data.task.labels ?? [],
      subtasks: data.task.subtasks ?? [],
      comments: data.task.comments ?? [],
      attachments: data.task.attachments ?? [],
      subtasksTotal: data.task.subtasks?.length ?? 0,
      subtasksCompleted: (data.task.subtasks ?? []).filter((item: Subtask) => item.completed).length,
    })
    setNewCommentBody("")
    setTaskDetailOpen(true)
  }

  async function saveTaskDetail() {
    if (!user?.id || !selectedTask) return

    const response = await fetch(`/api/tasks/${selectedTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        title: selectedTask.title,
        description: selectedTask.description,
        status: selectedTask.status,
        priority: selectedTask.priority,
        dueDate: selectedTask.dueDate,
        projectId: selectedTask.projectId,
        assigneeId: selectedTask.assigneeId,
        labelIds: selectedTask.labels.map((label) => label.id),
        subtasks: selectedTask.subtasks,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not update task")
      return
    }

    const subtasksTotal = selectedTask.subtasks.length
    const subtasksCompleted = selectedTask.subtasks.filter((item) => item.completed).length
    const memberName = (membersByWorkspace[selectedTask.workspaceId] ?? []).find((member) => member.id === selectedTask.assigneeId)?.name ?? selectedTask.assignee ?? null
    setTasks((current) =>
      current.map((task) =>
        task.id === selectedTask.id
          ? { ...task, ...selectedTask, assignee: memberName, subtasksTotal, subtasksCompleted }
          : task
      )
    )
    setTaskDetailOpen(false)
  }

  async function deleteTask(taskId: number) {
    if (!user?.id) return
    const response = await fetch(`/api/tasks/${taskId}?userId=${user.id}`, { method: "DELETE" })
    if (!response.ok) {
      const data = await response.json()
      setError(data.error ?? "Could not delete task")
      return
    }
    setTasks((current) => current.filter((task) => task.id !== taskId))
    setTaskDetailOpen(false)
  }

  async function addComment() {
    if (!user?.id || !selectedTask || !newCommentBody.trim()) return

    setIsSubmittingComment(true)
    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          body: newCommentBody,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not add comment")
        return
      }

      setSelectedTask((current) => current ? ({
        ...current,
        comments: [...current.comments, data.comment],
      }) : current)
      setNewCommentBody("")
    } finally {
      setIsSubmittingComment(false)
    }
  }

  async function deleteComment(commentId: number) {
    if (!user?.id || !selectedTask) return

    const response = await fetch(`/api/tasks/${selectedTask.id}/comments/${commentId}?userId=${user.id}`, {
      method: "DELETE",
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not delete comment")
      return
    }

    setSelectedTask((current) => current ? ({
      ...current,
      comments: current.comments.filter((comment) => comment.id !== commentId),
    }) : current)
  }

  async function uploadAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    if (!user?.id || !selectedTask) return

    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setIsUploadingAttachment(true)
    try {
      const formData = new FormData()
      formData.append("userId", user.id)
      formData.append("file", file)

      const response = await fetch(`/api/tasks/${selectedTask.id}/attachments`, {
        method: "POST",
        body: formData,
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not upload attachment")
        return
      }

      setSelectedTask((current) => current ? ({
        ...current,
        attachments: [data.attachment, ...current.attachments],
      }) : current)
    } finally {
      setIsUploadingAttachment(false)
    }
  }

  async function deleteAttachment(attachmentId: number) {
    if (!user?.id || !selectedTask) return

    const response = await fetch(`/api/tasks/${selectedTask.id}/attachments/${attachmentId}?userId=${user.id}`, {
      method: "DELETE",
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not delete attachment")
      return
    }

    setSelectedTask((current) => current ? ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
    }) : current)
  }

  async function createLabelForSelectedWorkspace() {
    if (!user?.id || !newTask.workspaceId || !newLabelName.trim()) return
    const workspaceId = Number(newTask.workspaceId)
    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        workspaceId,
        name: newLabelName,
        color: labelColors[Math.floor(Math.random() * labelColors.length)],
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not create label")
      return
    }
    setLabelsByWorkspace((current) => ({
      ...current,
      [workspaceId]: [...(current[workspaceId] ?? []), data.label],
    }))
    setNewTask((current) => ({ ...current, labelIds: [...current.labelIds, data.label.id] }))
    setNewLabelName("")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Manage, plan, and review tasks across list, board, and calendar views</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />New Task</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
              <DialogDescription>Add a task to one of your workspaces</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Workspace">
                  <Select value={newTask.workspaceId} onValueChange={(value) => setNewTask((current) => ({ ...current, workspaceId: value, labelIds: [] }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select workspace" /></SelectTrigger>
                    <SelectContent>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={newTask.status} onValueChange={(value) => setNewTask((current) => ({ ...current, status: value }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.title}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project">
                  <Select value={newTask.projectId} onValueChange={(value) => setNewTask((current) => ({ ...current, projectId: value }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Project</SelectItem>
                      {(projectsByWorkspace[Number(newTask.workspaceId)] ?? []).map((project) => (
                        <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Assignee">
                  <Select value={newTask.assigneeId} onValueChange={(value) => setNewTask((current) => ({ ...current, assigneeId: value }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">Assign to Me</SelectItem>
                      {(membersByWorkspace[Number(newTask.workspaceId)] ?? []).map((member) => (
                        <SelectItem key={member.id} value={String(member.id)}>{member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Title">
                <Input value={newTask.title} onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))} />
              </Field>
              <Field label="Description">
                <Textarea value={newTask.description} onChange={(event) => setNewTask((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Priority">
                  <Select value={newTask.priority} onValueChange={(value) => setNewTask((current) => ({ ...current, priority: value }))}>
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
              <Field label="Labels">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(labelsByWorkspace[Number(newTask.workspaceId)] ?? []).map((label) => {
                      const selected = newTask.labelIds.includes(label.id)
                      return (
                        <Button
                          key={label.id}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          className="gap-2"
                          onClick={() =>
                            setNewTask((current) => ({
                              ...current,
                              labelIds: selected
                                ? current.labelIds.filter((id) => id !== label.id)
                                : [...current.labelIds, label.id],
                            }))
                          }
                        >
                          <Tag className="h-3 w-3" />
                          {label.name}
                        </Button>
                      )
                    })}
                  </div>
                  {newTask.workspaceId && (
                    <div className="flex gap-2">
                      <Input placeholder="Create label" value={newLabelName} onChange={(event) => setNewLabelName(event.target.value)} />
                      <Button type="button" variant="outline" onClick={createLabelForSelectedWorkspace}>Add Label</Button>
                    </div>
                  )}
                </div>
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTask}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total Tasks" value={stats.total} />
        <StatCard title="Completed" value={stats.completed} tone="text-green-500" />
        <StatCard title="In Progress" value={stats.inProgress} tone="text-blue-500" />
        <StatCard title="Overdue" value={stats.overdue} tone="text-red-500" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks, workspaces, or labels..." className="pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="list"><List className="h-4 w-4" />List</TabsTrigger>
          <TabsTrigger value="board"><CheckSquare className="h-4 w-4" />Board</TabsTrigger>
          <TabsTrigger value="calendar"><Calendar className="h-4 w-4" />Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-muted-foreground">Loading tasks...</div>
              ) : filteredTasks.length === 0 ? (
                <div className="p-6 text-muted-foreground">No tasks found. Create a workspace and add your first task.</div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className={`flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 ${task.status === "done" ? "opacity-60" : ""}`}>
                      <Checkbox checked={task.status === "done"} onCheckedChange={() => toggleTaskComplete(task)} />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openTaskDetail(task.id)}>
                        <p className={`truncate font-medium ${task.status === "done" ? "line-through" : ""}`}>{task.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm text-muted-foreground">{task.workspace}</span>
                          {task.dueDate && <span className="flex items-center text-sm text-muted-foreground"><Calendar className="mr-1 h-3 w-3" />{task.dueDate}</span>}
                          {task.subtasksTotal > 0 && <span className="text-xs text-muted-foreground">{task.subtasksCompleted}/{task.subtasksTotal} subtasks</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {task.labels.map((label) => (
                            <Badge key={label.id} variant="outline" className="gap-1">{label.name}</Badge>
                          ))}
                        </div>
                      </button>
                      <div className="flex items-center gap-3">
                        <Badge className={statusColors[task.status]}>{task.status.replace("-", " ")}</Badge>
                        <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{task.assignee?.split(" ").map((part) => part[0]).join("") || "U"}</AvatarFallback></Avatar>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="board">
          <ScrollArea className="pb-4">
            <div className="flex gap-4 pb-4">
              {groupedTasks.map((column) => (
                <div key={column.id} className="w-80 flex-shrink-0 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center justify-between border-b border-border p-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{column.title}</h3>
                      <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs">{column.tasks.length}</Badge>
                    </div>
                  </div>
                  <div className="space-y-2 p-2">
                    {column.tasks.map((task) => (
                      <Card key={task.id} className="cursor-pointer" onClick={() => openTaskDetail(task.id)}>
                        <CardContent className="space-y-3 p-3">
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                            {task.labels.slice(0, 2).map((label) => <Badge key={label.id} variant="outline">{label.name}</Badge>)}
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{task.workspace}</span>
                            {task.dueDate && <span>{task.dueDate}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {!column.tasks.length && <p className="p-2 text-sm text-muted-foreground">No tasks</p>}
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {calendarGroups.length === 0 ? (
              <Card><CardContent className="p-6 text-muted-foreground">No dated tasks to show in calendar view.</CardContent></Card>
            ) : (
              calendarGroups.map((group) => (
                <Card key={group.date}>
                  <CardHeader>
                    <CardTitle className="text-lg">{group.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {group.tasks.map((task) => (
                      <button key={task.id} type="button" className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50" onClick={() => openTaskDetail(task.id)}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{task.title}</p>
                          <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{task.workspace}</p>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={taskDetailOpen} onOpenChange={setTaskDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task details, labels, and subtasks.</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <Field label="Title" className="flex-1">
                  <Input value={selectedTask.title} onChange={(event) => setSelectedTask({ ...selectedTask, title: event.target.value })} />
                </Field>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onClick={() => deleteTask(selectedTask.id)}>
                      <Trash2 className="h-4 w-4" />
                      Delete task
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Field label="Description">
                <Textarea value={selectedTask.description ?? ""} onChange={(event) => setSelectedTask({ ...selectedTask, description: event.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Project">
                  <Select value={selectedTask.projectId ? String(selectedTask.projectId) : "none"} onValueChange={(value) => setSelectedTask({ ...selectedTask, projectId: value === "none" ? null : Number(value) })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Project</SelectItem>
                      {(projectsByWorkspace[selectedTask.workspaceId] ?? []).map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={selectedTask.status} onValueChange={(value) => setSelectedTask({ ...selectedTask, status: value as Task["status"] })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.title}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Priority">
                  <Select value={selectedTask.priority} onValueChange={(value) => setSelectedTask({ ...selectedTask, priority: value as Task["priority"] })}>
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
                  <Input type="date" value={selectedTask.dueDate ?? ""} onChange={(event) => setSelectedTask({ ...selectedTask, dueDate: event.target.value })} />
                </Field>
              </div>
              <Field label="Assignee">
                <Select value={selectedTask.assigneeId ? String(selectedTask.assigneeId) : "none"} onValueChange={(value) => setSelectedTask({ ...selectedTask, assigneeId: value === "none" ? null : Number(value) })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(membersByWorkspace[selectedTask.workspaceId] ?? []).map((member) => (
                      <SelectItem key={member.id} value={String(member.id)}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Labels">
                <div className="flex flex-wrap gap-2">
                  {(labelsByWorkspace[selectedTask.workspaceId] ?? []).map((label) => {
                    const selected = selectedTask.labels.some((item) => item.id === label.id)
                    return (
                      <Button
                        key={label.id}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        onClick={() =>
                          setSelectedTask({
                            ...selectedTask,
                            labels: selected
                              ? selectedTask.labels.filter((item) => item.id !== label.id)
                              : [...selectedTask.labels, label],
                          })
                        }
                      >
                        {label.name}
                      </Button>
                    )
                  })}
                </div>
              </Field>
              <Field label="Subtasks">
                <div className="space-y-3">
                  {selectedTask.subtasks.map((subtask, index) => (
                    <div key={`${subtask.id ?? "new"}-${index}`} className="flex items-center gap-3">
                      <Checkbox
                        checked={subtask.completed}
                        onCheckedChange={(checked) =>
                          setSelectedTask({
                            ...selectedTask,
                            subtasks: selectedTask.subtasks.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, completed: checked === true } : item
                            ),
                          })
                        }
                      />
                      <Input
                        value={subtask.title}
                        onChange={(event) =>
                          setSelectedTask({
                            ...selectedTask,
                            subtasks: selectedTask.subtasks.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, title: event.target.value } : item
                            ),
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSelectedTask({
                            ...selectedTask,
                            subtasks: selectedTask.subtasks.filter((_, itemIndex) => itemIndex !== index),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSelectedTask({
                        ...selectedTask,
                        subtasks: [...selectedTask.subtasks, { title: "", completed: false }],
                      })
                    }
                  >
                    Add subtask
                  </Button>
                </div>
              </Field>
              <Field label="Comments">
                <div className="space-y-3">
                  <div className="space-y-2">
                    {selectedTask.comments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                        No comments yet.
                      </div>
                    ) : (
                      selectedTask.comments.map((comment) => (
                        <div key={comment.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium">{comment.userName ?? "Unknown user"}</span>
                                <span className="text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
                            </div>
                            {String(comment.userId ?? "") === user?.id && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => deleteComment(comment.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add a comment"
                      value={newCommentBody}
                      onChange={(event) => setNewCommentBody(event.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button type="button" onClick={addComment} disabled={isSubmittingComment || !newCommentBody.trim()}>
                        <MessageSquare className="h-4 w-4" />
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>
              </Field>
              <Field label="Attachments">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="task-attachment-upload" className="sr-only">Upload attachment</Label>
                    <Input
                      id="task-attachment-upload"
                      type="file"
                      className="max-w-sm"
                      onChange={uploadAttachment}
                      disabled={isUploadingAttachment}
                    />
                    <div className="text-xs text-muted-foreground">Up to 10 MB per file.</div>
                  </div>
                  {selectedTask.attachments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                      No attachments yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTask.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                              <Link href={attachment.fileUrl} target="_blank" className="truncate text-sm font-medium hover:underline">
                                {attachment.fileName}
                              </Link>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatFileSize(attachment.fileSizeBytes)}{attachment.uploadedByName ? ` • ${attachment.uploadedByName}` : ""}{attachment.createdAt ? ` • ${formatDateTime(attachment.createdAt)}` : ""}
                            </div>
                          </div>
                          {String(attachment.uploadedBy ?? "") === user?.id && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => deleteAttachment(attachment.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDetailOpen(false)}>Cancel</Button>
            <Button onClick={saveTaskDetail}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      {children}
    </div>
  )
}

function StatCard({ title, value, tone }: { title: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={`text-2xl font-bold ${tone ?? ""}`}>{value}</div>
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  )
}

function groupByDueDate(tasks: Task[]) {
  const datedTasks = tasks.filter((task) => task.dueDate)
  const groups = new Map<string, Task[]>()

  for (const task of datedTasks) {
    const key = task.dueDate!
    groups.set(key, [...(groups.get(key) ?? []), task])
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, groupedTasks]) => ({
      date,
      label: new Date(date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
      tasks: groupedTasks,
    }))
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) {
    return "Unknown size"
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
