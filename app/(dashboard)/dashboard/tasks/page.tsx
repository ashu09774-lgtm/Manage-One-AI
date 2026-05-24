"use client"

import { useEffect, useState, useMemo } from "react"
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
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { KanbanBoard } from "@/components/tasks/kanban-board"
import { TimeTracker } from "@/components/tasks/time-tracker"
import { DeleteTaskDialog } from "@/components/tasks/delete-task-dialog"
import { toast } from "sonner"
import { AnimatePresence, motion } from "framer-motion"
import { Calendar, CheckSquare, Filter, Image as ImageIcon, List, MessageSquare, MoreHorizontal, Paperclip, Plus, Search, Sparkles, Tag, Trash2, X } from "lucide-react"

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
  aiGenerated?: boolean
  aiAgentRunId?: number | null
  aiGoal?: string | null
}

interface TaskDetail extends Task {
  subtasks: Subtask[]
  comments: TaskComment[]
  attachments: TaskAttachment[]
  dependencies: TaskDependency[]
}

interface TaskDependency {
  id: number
  title: string
  status: string
  priority: string
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

interface TaskTemplate {
  id: number
  name: string
  templateData: {
    title: string
    description: string
    priority: string
    status: string
    workspaceId?: string
    projectId?: string
    labelIds?: number[]
  }
}

interface GeneratedAiTask {
  title: string
  description: string | null
  priority: "low" | "medium" | "high" | "urgent"
  dueDate: string | null
  subtasks: string[]
}

interface AiTaskGroup {
  id: number
  goal: string
  workspace: string | null
  total: number
  completed: number
  progress: number
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
  const [deleteTaskOpen, setDeleteTaskOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState("")
  const [newCommentBody, setNewCommentBody] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [newDependencyId, setNewDependencyId] = useState("")
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())
  const [isBulkActing, setIsBulkActing] = useState(false)
  const [aiGoal, setAiGoal] = useState("")
  const [aiWorkspaceId, setAiWorkspaceId] = useState("")
  const [aiProjectId, setAiProjectId] = useState("none")
  const [aiDueDateStyle, setAiDueDateStyle] = useState("flexible")
  const [aiIncludeSubtasks, setAiIncludeSubtasks] = useState(true)
  const [aiPreview, setAiPreview] = useState<{
    goal: string
    workspaceId: number
    projectId: number | null
    tasks: GeneratedAiTask[]
    requiresConfirmation: boolean
  } | null>(null)
  const [aiConfirmed, setAiConfirmed] = useState(false)
  const [aiTaskGroups, setAiTaskGroups] = useState<AiTaskGroup[]>([])
  const [isCreatingAiTasks, setIsCreatingAiTasks] = useState(false)
  const [isSavingAiTasks, setIsSavingAiTasks] = useState(false)
  const [completingAiGroupId, setCompletingAiGroupId] = useState<number | null>(null)
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
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("manageone_user")
      if (storedUser) setUser(JSON.parse(storedUser))
    } catch (err) {
      console.error("Failed to parse user from localStorage", err)
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void loadData(user.id)
    void loadTemplates(user.id)
  }, [user])

  useEffect(() => {
    if (!user?.id || !newTask.workspaceId) return
    const workspaceId = Number(newTask.workspaceId)
    if (!labelsByWorkspace[workspaceId]) void loadLabels(workspaceId, user.id)
    if (!membersByWorkspace[workspaceId]) void loadMembers(workspaceId, user.id)
    if (!projectsByWorkspace[workspaceId]) void loadProjects(workspaceId, user.id)
  }, [newTask.workspaceId, user, labelsByWorkspace, membersByWorkspace, projectsByWorkspace])

  useEffect(() => {
    if (!user?.id || !aiWorkspaceId) return
    const workspaceId = Number(aiWorkspaceId)
    if (!projectsByWorkspace[workspaceId]) void loadProjects(workspaceId, user.id)
  }, [aiWorkspaceId, user, projectsByWorkspace])

  const filteredTasks = useMemo(() => (tasks || []).filter((task) => {
    const matchesSearch =
      (task.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.workspace || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.labels || []).some((label) => (label.name || "").toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  }), [tasks, searchQuery, statusFilter, priorityFilter])

  const groupedTasks = useMemo(() => columns.map((column) => ({
    ...column,
    tasks: filteredTasks.filter((task) => task.status === column.id),
  })), [filteredTasks])

  const stats = useMemo(() => ({
    total: (tasks || []).length,
    completed: (tasks || []).filter((task) => task.status === "done").length,
    inProgress: (tasks || []).filter((task) => task.status === "in-progress").length,
    overdue: (tasks || []).filter((task) => task.dueDate && task.status !== "done" && new Date(task.dueDate) < new Date()).length,
  }), [tasks])

  const calendarGroups = useMemo(() => groupByDueDate(filteredTasks), [filteredTasks])

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
      setTasks(tasksData.tasks || [])
      setWorkspaces(workspacesData.workspaces || [])
      void loadAiTaskGroups(userId)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load tasks")
    } finally {
      setIsLoading(false)
    }
  }

  async function loadLabels(workspaceId: number, userId: string) {
    const response = await fetch(`/api/labels?userId=${userId}&workspaceId=${workspaceId}`)
    if (!response.ok) {
      setLabelsByWorkspace((current) => ({ ...current, [workspaceId]: [] }))
      return
    }
    const data = await response.json()
    setLabelsByWorkspace((current) => ({ ...current, [workspaceId]: data.labels || [] }))
  }

  async function loadMembers(workspaceId: number, userId: string) {
    const response = await fetch(`/api/workspaces/${workspaceId}/members?userId=${userId}`)
    if (!response.ok) {
      setMembersByWorkspace((current) => ({ ...current, [workspaceId]: [] }))
      return
    }
    const data = await response.json()
    setMembersByWorkspace((current) => ({ ...current, [workspaceId]: data.members || [] }))
  }

  async function loadProjects(workspaceId: number, userId: string) {
    const response = await fetch(`/api/workspaces/${workspaceId}/projects?userId=${userId}`)
    if (!response.ok) {
      setProjectsByWorkspace((current) => ({ ...current, [workspaceId]: [] }))
      return
    }
    const data = await response.json()
    setProjectsByWorkspace((current) => ({ ...current, [workspaceId]: data.projects || [] }))
  }

  async function loadTemplates(userId: string) {
    try {
      const response = await fetch(`/api/tasks/templates?userId=${userId}`)
      const data = await response.json()
      if (response.ok) setTemplates(data.templates || [])
    } catch (err) {
      console.error("Failed to load templates", err)
    }
  }

  async function saveAsTemplate() {
    if (!user?.id || !selectedTask) return
    const name = window.prompt("Enter a name for this template:")
    if (!name?.trim()) return

    setIsSavingTemplate(true)
    try {
      const response = await fetch("/api/tasks/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          name: name.trim(),
          templateData: {
            title: selectedTask.title,
            description: selectedTask.description,
            priority: selectedTask.priority,
            status: selectedTask.status,
            workspaceId: String(selectedTask.workspaceId),
            projectId: selectedTask.projectId ? String(selectedTask.projectId) : "none",
            labelIds: selectedTask.labels.map(l => l.id),
          },
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setTemplates((current) => [...current, data.template])
      toast.success("Template saved successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setIsSavingTemplate(false)
    }
  }

  function applyTemplate(template: TaskTemplate) {
    const { templateData } = template
    setNewTask((current) => ({
      ...current,
      title: templateData.title || "",
      description: templateData.description || "",
      priority: (templateData.priority as any) || "medium",
      status: (templateData.status as any) || "todo",
      workspaceId: templateData.workspaceId || current.workspaceId,
      projectId: templateData.projectId || "none",
      labelIds: templateData.labelIds || [],
    }))
    toast.success(`Applied template: ${template.name}`)
  }

  async function deleteTemplate(id: number) {
    if (!user?.id || !window.confirm("Delete this template?")) return
    try {
      const response = await fetch(`/api/tasks/templates/${id}?userId=${user.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete template")
      setTemplates((current) => current.filter((t) => t.id !== id))
      toast.success("Template deleted")
    } catch (err) {
      toast.error("Could not delete template")
    }
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
    
    if (completed) {
      toast.success("Task completed!")
    } else {
      toast.success("Task marked as to-do")
    }
  }

  async function handleTaskMove(taskId: string | number, newStatus: string, newIndex: number) {
    if (!user?.id) return
    const id = Number(taskId)
    
    // Optimistic update
    setTasks((current) => current.map((item) => item.id === id ? { ...item, status: newStatus as Task["status"] } : item))
    
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, status: newStatus }),
      })
      if (!response.ok) throw new Error("Update failed")
    } catch {
      toast.error("Failed to update task status")
      void loadData(user.id) // Revert on failure
    }
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
      toast.error(data.error ?? "Could not create task")
      setError(data.error ?? "Could not create task")
      return
    }

    toast.success("Task created successfully")

    const workspace = workspaces.find((item) => item.id === Number(newTask.workspaceId))
    const labels = (labelsByWorkspace[Number(newTask.workspaceId)] ?? []).filter((label) => newTask.labelIds.includes(label.id))
    const members = membersByWorkspace[Number(newTask.workspaceId)] ?? []
    const assigneeName = newTask.assigneeId === "me"
      ? "You"
      : members.find((member) => member.id === Number(newTask.assigneeId))?.name ?? "Unassigned"
    setTasks((current) => [{ ...(data.task || {}), workspace: workspace?.name ?? "Workspace", assignee: assigneeName, labels }, ...current])
    setNewTask({ title: "", description: "", workspaceId: "", projectId: "none", assigneeId: "me", priority: "medium", dueDate: "", status: "todo", labelIds: [] })
    setDialogOpen(false)
  }

  async function loadAiTaskGroups(userId: string) {
    try {
      const response = await fetch(`/api/ai-tasks?userId=${userId}`)
      const data = await response.json()
      if (response.ok) setAiTaskGroups(data.groups || [])
    } catch (err) {
      console.error("Failed to load AI task groups", err)
    }
  }

  async function handleCreateAiTasks() {
    if (!user?.id || !aiGoal.trim()) return

    setIsCreatingAiTasks(true)
    try {
      const response = await fetch("/api/ai-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          action: "preview",
          goal: aiGoal.trim(),
          workspaceId: aiWorkspaceId ? Number(aiWorkspaceId) : null,
          projectId: aiProjectId === "none" ? null : Number(aiProjectId),
          dueDateStyle: aiDueDateStyle,
          includeSubtasks: aiIncludeSubtasks,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? "Could not create AI tasks")
        return
      }

      setAiPreview(data.preview)
      setAiConfirmed(false)
      toast.success(`AI prepared ${data.preview.tasks.length} tasks`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create AI tasks")
    } finally {
      setIsCreatingAiTasks(false)
    }
  }

  async function saveAiPreview() {
    if (!user?.id || !aiPreview) return

    setIsSavingAiTasks(true)
    try {
      const response = await fetch("/api/ai-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          goal: aiPreview.goal,
          workspaceId: aiPreview.workspaceId,
          projectId: aiPreview.projectId,
          tasks: aiPreview.tasks,
          confirmed: aiConfirmed,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? "Could not save AI tasks")
        return
      }

      toast.success(`Saved ${data.plan.tasks.length} AI tasks`)
      setAiGoal("")
      setAiProjectId("none")
      setAiDueDateStyle("flexible")
      setAiIncludeSubtasks(true)
      setAiPreview(null)
      setAiConfirmed(false)
      await loadData(user.id)
      await loadAiTaskGroups(user.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save AI tasks")
    } finally {
      setIsSavingAiTasks(false)
    }
  }

  async function completeAiTaskGroup(groupId: number) {
    if (!user?.id) return

    setCompletingAiGroupId(groupId)
    try {
      const response = await fetch("/api/ai-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, runId: groupId, action: "complete" }),
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? "Could not complete AI goal")
        return
      }

      toast.success("AI goal marked complete")
      await loadData(user.id)
      await loadAiTaskGroups(user.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete AI goal")
    } finally {
      setCompletingAiGroupId(null)
    }
  }

  async function openTaskDetail(taskId: number) {
    if (!user?.id) return
    const response = await fetch(`/api/tasks/${taskId}?userId=${user.id}`)
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not load task")
      return
    }
    const [depsResponse] = await Promise.all([
      fetch(`/api/tasks/${taskId}/dependencies?userId=${user.id}`),
      loadLabels(Number(data.task.workspaceId), user.id),
      loadMembers(Number(data.task.workspaceId), user.id),
      loadProjects(Number(data.task.workspaceId), user.id)
    ])
    
    const depsData = depsResponse.ok ? await depsResponse.json() : { dependencies: [] }

    setSelectedTask({
      ...data.task,
      labels: data.task.labels ?? [],
      subtasks: data.task.subtasks ?? [],
      comments: data.task.comments ?? [],
      attachments: data.task.attachments ?? [],
      dependencies: depsData.dependencies ?? [],
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
      toast.error(data.error ?? "Could not update task")
      setError(data.error ?? "Could not update task")
      return
    }

    toast.success("Task updated successfully")

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
      toast.error(data.error ?? "Could not delete task")
      setError(data.error ?? "Could not delete task")
      return
    }
    toast.success("Task deleted")
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

  async function addDependency() {
    if (!user?.id || !selectedTask || !newDependencyId) return
    const response = await fetch(`/api/tasks/${selectedTask.id}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, dependsOnTaskId: Number(newDependencyId) }),
    })
    const data = await response.json()
    if (!response.ok) {
      toast.error(data.error ?? "Could not add dependency")
      return
    }
    toast.success("Dependency added")
    setSelectedTask((current) => current ? ({ ...current, dependencies: [data.dependency, ...current.dependencies] }) : current)
    setNewDependencyId("")
  }

  async function removeDependency(depId: number) {
    if (!user?.id || !selectedTask) return
    const response = await fetch(`/api/tasks/${selectedTask.id}/dependencies/${depId}?userId=${user.id}`, { method: "DELETE" })
    if (!response.ok) {
      toast.error("Could not remove dependency")
      return
    }
    toast.success("Dependency removed")
    setSelectedTask((current) => current ? ({ ...current, dependencies: current.dependencies.filter(d => d.id !== depId) }) : current)
  }

  function toggleSelectTask(taskId: number) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedTaskIds.size === filteredTasks.length) {
      setSelectedTaskIds(new Set())
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)))
    }
  }

  async function handleBulkAction(action: string, value?: string) {
    if (!user?.id || selectedTaskIds.size === 0) return
    setIsBulkActing(true)
    try {
      const response = await fetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, taskIds: Array.from(selectedTaskIds), action, value }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? "Bulk action failed")
        return
      }
      if (action === "delete") {
        toast.success(`${data.deleted} tasks deleted`)
        setTasks((current) => current.filter(t => !selectedTaskIds.has(t.id)))
      } else if (action === "status") {
        toast.success(`${data.updated} tasks updated to ${value}`)
        setTasks((current) => current.map(t => selectedTaskIds.has(t.id) ? { ...t, status: value as Task["status"] } : t))
      } else if (action === "priority") {
        toast.success(`${data.updated} tasks updated to ${value} priority`)
        setTasks((current) => current.map(t => selectedTaskIds.has(t.id) ? { ...t, priority: value as Task["priority"] } : t))
      }
      setSelectedTaskIds(new Set())
    } finally {
      setIsBulkActing(false)
    }
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
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new task to your workspace. Link it to a project and assign it to a team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {templates.length > 0 && (
              <Field label="Apply Template">
                <Select onValueChange={(id) => {
                  const template = templates.find(t => String(t.id) === id)
                  if (template) applyTemplate(template)
                }}>
                  <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
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
                <RichTextEditor value={newTask.description} onChange={(value) => setNewTask((current) => ({ ...current, description: value }))} />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Task Creator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={aiGoal}
            onChange={(event) => setAiGoal(event.target.value)}
            placeholder="Tell AI what you need to do..."
            className="min-h-24"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <Select
              value={aiWorkspaceId}
              onValueChange={(value) => {
                setAiWorkspaceId(value)
                setAiProjectId("none")
              }}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Default workspace" /></SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={aiProjectId} onValueChange={setAiProjectId} disabled={!aiWorkspaceId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="No project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Project</SelectItem>
                {(projectsByWorkspace[Number(aiWorkspaceId)] ?? []).map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={aiDueDateStyle} onValueChange={setAiDueDateStyle}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flexible">Flexible Dates</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="none">No Dates</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleCreateAiTasks} disabled={isCreatingAiTasks || !aiGoal.trim()} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {isCreatingAiTasks ? "Preparing..." : "Preview Tasks"}
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={aiIncludeSubtasks} onCheckedChange={(checked) => setAiIncludeSubtasks(checked === true)} />
            Create subtasks
          </label>
          {aiPreview && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Preview</p>
                  <p className="text-xs text-muted-foreground">{aiPreview.tasks.length} tasks ready to save</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAiPreview(null)} disabled={isSavingAiTasks}>Discard</Button>
                  <Button size="sm" onClick={saveAiPreview} disabled={isSavingAiTasks || (aiPreview.requiresConfirmation && !aiConfirmed)}>
                    {isSavingAiTasks ? "Saving..." : "Save Tasks"}
                  </Button>
                </div>
              </div>
              {aiPreview.requiresConfirmation && (
                <label className="flex items-center gap-2 rounded-md bg-amber-500/10 p-2 text-sm">
                  <Checkbox checked={aiConfirmed} onCheckedChange={(checked) => setAiConfirmed(checked === true)} />
                  Confirm this plan before saving
                </label>
              )}
              <div className="grid gap-2">
                {aiPreview.tasks.map((task, index) => (
                  <div key={`${task.title}-${index}`} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{task.title}</p>
                      <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                      {task.dueDate && <Badge variant="outline">{task.dueDate}</Badge>}
                    </div>
                    {task.description && <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>}
                    {task.subtasks.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">{task.subtasks.length} subtasks</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {aiTaskGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {aiTaskGroups.map((group) => (
              <div key={group.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{group.goal}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.completed}/{group.total} tasks done{group.workspace ? ` in ${group.workspace}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={group.progress === 100 || completingAiGroupId === group.id}
                    onClick={() => completeAiTaskGroup(group.id)}
                  >
                    Complete
                  </Button>
                </div>
                <Progress value={group.progress} className="mt-3 h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                <div className="p-4 space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : filteredTasks.length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  title="No tasks found"
                  description="Create a workspace and add your first task."
                />
              ) : (
                <>
                  <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                    <Checkbox checked={selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0} onCheckedChange={toggleSelectAll} />
                    <span className="text-xs text-muted-foreground">{selectedTaskIds.size > 0 ? `${selectedTaskIds.size} selected` : "Select all"}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {filteredTasks.map((task) => (
                      <div key={task.id} className={`flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 ${task.status === "done" ? "opacity-60" : ""} ${selectedTaskIds.has(task.id) ? "bg-primary/5" : ""}`}>
                        <Checkbox checked={selectedTaskIds.has(task.id)} onCheckedChange={() => toggleSelectTask(task.id)} />
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openTaskDetail(task.id)}>
                          <p className={`truncate font-medium ${task.status === "done" ? "line-through" : ""}`}>{task.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground">{task.workspace}</span>
                            {task.aiGenerated && <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" />AI</Badge>}
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
                          <Badge className={statusColors[task.status] || "bg-muted text-muted-foreground"}>{(task.status || "").replace("-", " ")}</Badge>
                          <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {(task.assignee?.split(" ") ?? []).map((part) => part[0]).join("") || "U"}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="board">
          <ScrollArea className="pb-4">
            <KanbanBoard
              columns={columns}
              tasks={filteredTasks}
              onTaskMove={handleTaskMove}
              renderTask={(task) => (
                <Card className="cursor-grab hover:shadow-md transition-shadow active:cursor-grabbing border-border bg-card" onClick={() => openTaskDetail(task.id)}>
                  <CardContent className="space-y-3 p-3">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                      {task.aiGenerated && <Badge variant="outline">AI</Badge>}
                      {task.labels.slice(0, 2).map((label) => <Badge key={label.id} variant="outline">{label.name}</Badge>)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{task.workspace}</span>
                      {task.dueDate && <span>{task.dueDate}</span>}
                    </div>
                  </CardContent>
                </Card>
              )}
            />
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
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteTaskOpen(true)}>
                      <Trash2 className="h-4 w-4" />
                      Delete task
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Field label="Time Tracking">
                <TimeTracker taskId={selectedTask.id} userId={Number(user?.id || 0)} />
              </Field>
              <Field label="Description">
                <RichTextEditor value={selectedTask.description ?? ""} onChange={(value) => setSelectedTask({ ...selectedTask, description: value })} />
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
                <div className="space-y-4">
                  <div className="space-y-3">
                    {selectedTask.comments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                        No comments yet. Be the first to chime in!
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
                              <p className="whitespace-pre-wrap text-sm text-foreground">
                                {comment.body.split(/(@\w+)/g).map((part, i) => 
                                  part.startsWith("@") ? (
                                    <span key={i} className="font-semibold text-primary">{part}</span>
                                  ) : (
                                    part
                                  )
                                )}
                              </p>
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
                  <div className="relative space-y-2">
                    <Textarea
                      placeholder="Add a comment... Type @ to mention someone"
                      value={newCommentBody}
                      onChange={(event) => {
                        const val = event.target.value
                        setNewCommentBody(val)
                        const lastChar = val[event.target.selectionStart - 1]
                        if (lastChar === "@") setShowMentionDropdown(true)
                        else if (!val.includes("@") || lastChar === " ") setShowMentionDropdown(false)
                      }}
                    />
                    {showMentionDropdown && (
                      <Card className="absolute bottom-full left-0 z-50 mb-2 w-48 shadow-xl">
                        <ScrollArea className="h-48">
                          <div className="p-1">
                            {(membersByWorkspace[selectedTask.workspaceId] ?? []).map((member) => (
                              <button
                                key={member.id}
                                type="button"
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                onClick={() => {
                                  const parts = newCommentBody.split("@")
                                  parts.pop()
                                  setNewCommentBody(parts.join("@") + "@" + member.name.replace(/\s+/g, "") + " ")
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
                              {attachment.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                <ImageIcon className="h-4 w-4 text-blue-500" />
                              ) : (
                                <Paperclip className="h-4 w-4 text-muted-foreground" />
                              )}
                              <Link href={attachment.fileUrl} target="_blank" className="truncate text-sm font-medium hover:underline">
                                {attachment.fileName}
                              </Link>
                            </div>
                            {attachment.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                              <div className="mt-2 overflow-hidden rounded-md border">
                                <img src={attachment.fileUrl} alt={attachment.fileName} className="h-20 w-auto object-cover" />
                              </div>
                            )}
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
              <Field label="Dependencies">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Select value={newDependencyId} onValueChange={setNewDependencyId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select task to depend on" /></SelectTrigger>
                      <SelectContent>
                        {filteredTasks.filter(t => t.id !== selectedTask.id && t.workspaceId === selectedTask.workspaceId).map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={addDependency}>Add</Button>
                  </div>
                  {selectedTask.dependencies.length > 0 && (
                    <div className="space-y-2">
                      {selectedTask.dependencies.map(dep => (
                        <div key={dep.id} className="flex items-center justify-between rounded-md border border-border p-2">
                          <div className="flex items-center gap-2">
                            <Badge className={statusColors[dep.status as keyof typeof statusColors] || "bg-muted text-muted-foreground"}>{(dep.status || "").replace("-", " ")}</Badge>
                            <span className="text-sm font-medium">{dep.title}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDependency(dep.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
            </div>
          )}
          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <Button variant="ghost" size="sm" onClick={saveAsTemplate} disabled={isSavingTemplate}>
              <Tag className="mr-2 h-4 w-4" />
              Save as Template
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTaskDetailOpen(false)}>Cancel</Button>
              <Button onClick={saveTaskDetail}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {selectedTaskIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-2xl backdrop-blur-md">
              <span className="text-sm font-medium">{selectedTaskIds.size} selected</span>
              <div className="mx-1 h-5 w-px bg-border" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isBulkActing}>Move to…</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {columns.map((col) => (
                    <DropdownMenuItem key={col.id} onClick={() => handleBulkAction("status", col.id)}>{col.title}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isBulkActing}>Priority…</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkAction("priority", "urgent")}>Urgent</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction("priority", "high")}>High</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction("priority", "medium")}>Medium</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction("priority", "low")}>Low</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="destructive" size="sm" disabled={isBulkActing} onClick={() => handleBulkAction("delete")}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />Delete
              </Button>

              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedTaskIds(new Set())}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedTask && user && (
        <DeleteTaskDialog
          open={deleteTaskOpen}
          onOpenChange={setDeleteTaskOpen}
          taskId={selectedTask.id}
          taskTitle={selectedTask.title}
          userId={Number(user.id)}
          onDeleted={() => {
            setTasks((current) => current.filter((task) => task.id !== selectedTask.id))
            setTaskDetailOpen(false)
            setSelectedTask(null)
            toast.success("Task deleted successfully")
          }}
        />
      )}
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

function groupByDueDate(tasks: Task[] = []) {
  const datedTasks = (tasks || []).filter((task) => task.dueDate)
  const groups = new Map<string, Task[]>()

  for (const task of datedTasks) {
    const key = task.dueDate!
    groups.set(key, [...(groups.get(key) ?? []), task])
  }

  return [...groups.entries()]
    .sort(([left], [right]) => (left || "").localeCompare(right || ""))
    .map(([date, groupedTasks]) => ({
      date,
      label: formatDateTime(date).split(",")[0], // Fallback to formatDateTime for consistency
      tasks: groupedTasks,
    }))
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return ""
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

