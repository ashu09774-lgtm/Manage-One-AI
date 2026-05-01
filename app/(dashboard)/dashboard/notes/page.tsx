"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
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
import { toast } from "sonner"
import { Bold, Eye, FileText, History, Italic, Link2, ListChecks, Plus, RefreshCcw, Save, Search, Trash2, Users } from "lucide-react"

interface UserData {
  id: string
}

interface WorkspaceOption {
  id: number
  name: string
}

interface ProjectOption {
  id: number
  name: string
}

interface TaskOption {
  id: number
  workspaceId: number
  title: string
  status: string
  priority: string
}

interface NoteSummary {
  id: number
  workspaceId: number
  workspaceName: string
  projectId: number | null
  projectName: string | null
  title: string
  content: string
  docType: "note" | "documentation"
  updatedByName: string | null
  updatedAt: string
  linkedTasks: number
  revisions: number
}

interface NoteRevision {
  id: number
  title: string
  content: string
  editedByName: string | null
  createdAt: string
}

type NoteDetail = Omit<NoteSummary, "revisions"> & {
  taskIds: number[]
  revisions: NoteRevision[]
}

const emptyDraft = {
  id: null as number | null,
  workspaceId: "",
  projectId: "none",
  title: "",
  content: "",
  docType: "note" as "note" | "documentation",
  taskIds: [] as number[],
}

export default function NotesPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [tasks, setTasks] = useState<TaskOption[]>([])
  const [projectsByWorkspace, setProjectsByWorkspace] = useState<Record<number, ProjectOption[]>>({})
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [draft, setDraft] = useState(emptyDraft)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [docTypeFilter, setDocTypeFilter] = useState("all")
  const [revisions, setRevisions] = useState<NoteRevision[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [liveNotice, setLiveNotice] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [diffRevisionId, setDiffRevisionId] = useState<number | null>(null)
  const [viewers, setViewers] = useState<Record<number, { name: string, status: string }>>({})
  const editorRef = useRef<HTMLDivElement>(null)

  function scrollToEditor() {
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  useEffect(() => {
    const storedUser = localStorage.getItem("manageone_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void loadBaseData()
  }, [user])

  useEffect(() => {
    if (!user?.id) return
    void loadNotes()
  }, [user, selectedWorkspaceId, docTypeFilter])

  useEffect(() => {
    if (!user?.id || selectedWorkspaceId === "all") return

    const eventSource = new EventSource(`/api/collaboration/stream?userId=${user.id}&workspaceId=${selectedWorkspaceId}`)
    
    eventSource.addEventListener("note_updated", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { id: number; title: string; action?: string; updatedBy?: number }
      if (payload.updatedBy !== Number(user.id)) {
        setLiveNotice(`${payload.title} was ${payload.action ?? "updated"} in this workspace.`)
        void loadNotes()
      }
    })

    eventSource.addEventListener("note_presence", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { userId: number; userName: string; noteId: number; status: string }
      if (payload.userId === Number(user.id) || payload.noteId !== draft.id) return

      if (payload.status === "left") {
        setViewers((current) => {
          const next = { ...current }
          delete next[payload.userId]
          return next
        })
      } else {
        setViewers((current) => ({
          ...current,
          [payload.userId]: { name: payload.userName, status: payload.status },
        }))
      }
    })

    return () => eventSource.close()
  }, [user, selectedWorkspaceId, draft.id])

  useEffect(() => {
    if (!user?.id || !draft.id || !draft.workspaceId) return
    
    void broadcastPresence("viewing")
    
    const interval = setInterval(() => {
      void broadcastPresence("viewing")
    }, 10000)

    return () => {
      clearInterval(interval)
      void broadcastPresence("left")
    }
  }, [user, draft.id, draft.workspaceId])

  async function broadcastPresence(status: string) {
    if (!user?.id || !draft.id || !draft.workspaceId) return
    void fetch("/api/collaboration/notes/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, workspaceId: draft.workspaceId, noteId: draft.id, status }),
    })
  }

  const activeWorkspaceId = Number(draft.workspaceId)
  const availableProjects = activeWorkspaceId ? projectsByWorkspace[activeWorkspaceId] ?? [] : []
  const availableTasks = tasks.filter((task) => task.workspaceId === activeWorkspaceId)

  const metrics = useMemo(() => ({
    notes: notes.filter((note) => note.docType === "note").length,
    docs: notes.filter((note) => note.docType === "documentation").length,
    linked: notes.filter((note) => note.linkedTasks > 0).length,
    revisions: notes.reduce((total, note) => total + note.revisions, 0),
  }), [notes])

  async function loadBaseData() {
    if (!user?.id) return

    setIsLoading(true)
    setError("")
    try {
      const [workspaceResponse, taskResponse] = await Promise.all([
        fetch(`/api/workspaces?userId=${user.id}`),
        fetch(`/api/tasks?userId=${user.id}`),
      ])
      const workspaceData = await workspaceResponse.json()
      const taskData = await taskResponse.json()
      if (!workspaceResponse.ok) throw new Error(workspaceData.error)
      if (!taskResponse.ok) throw new Error(taskData.error)

      setWorkspaces(workspaceData.workspaces)
      setTasks(taskData.tasks.map((task: TaskOption) => ({
        id: task.id,
        workspaceId: task.workspaceId,
        title: task.title,
        status: task.status,
        priority: task.priority,
      })))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load notes data")
    } finally {
      setIsLoading(false)
    }
  }

  async function loadNotes() {
    if (!user?.id) return

    const params = new URLSearchParams({ userId: user.id })
    if (selectedWorkspaceId !== "all") params.set("workspaceId", selectedWorkspaceId)
    if (docTypeFilter !== "all") params.set("docType", docTypeFilter)
    if (searchQuery.trim()) params.set("q", searchQuery.trim())

    setError("")
    const response = await fetch(`/api/notes?${params.toString()}`)
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not load notes")
      return
    }

    setNotes(data.notes)
  }

  async function loadProjects(workspaceId: number) {
    if (!user?.id || projectsByWorkspace[workspaceId]) return

    const response = await fetch(`/api/workspaces/${workspaceId}/projects?userId=${user.id}`)
    const data = await response.json()
    if (!response.ok) return
    setProjectsByWorkspace((current) => ({ ...current, [workspaceId]: data.projects }))
  }

  async function openNote(noteId: number) {
    if (!user?.id) return

    const response = await fetch(`/api/notes/${noteId}?userId=${user.id}`)
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not load note")
      return
    }

    const note = data.note as NoteDetail
    await loadProjects(note.workspaceId)
    setDraft({
      id: note.id,
      workspaceId: String(note.workspaceId),
      projectId: note.projectId ? String(note.projectId) : "none",
      title: note.title,
      content: note.content,
      docType: note.docType,
      taskIds: note.taskIds,
    })
    setRevisions(note.revisions)
    scrollToEditor()
  }

  async function saveNote() {
    if (!user?.id || !draft.workspaceId || !draft.title.trim()) return

    setIsSaving(true)
    setError("")
    const payload = {
      userId: user.id,
      workspaceId: Number(draft.workspaceId),
      projectId: draft.projectId === "none" ? null : Number(draft.projectId),
      title: draft.title,
      content: draft.content,
      docType: draft.docType,
      taskIds: draft.taskIds,
    }

    const response = await fetch(draft.id ? `/api/notes/${draft.id}` : "/api/notes", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    setIsSaving(false)

    if (!response.ok) {
      setError(data.error ?? "Could not save note")
      return
    }

    if (!draft.id) {
      setDraft((current) => ({ ...current, id: data.note.id }))
    }
    await loadNotes()
    if (data.note.id ?? draft.id) {
      await openNote(data.note.id ?? draft.id)
    }
  }

  async function deleteNote() {
    if (!user?.id || !draft.id) return

    const response = await fetch(`/api/notes/${draft.id}?userId=${user.id}`, { method: "DELETE" })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not delete note")
      return
    }

    setDraft(emptyDraft)
    setRevisions([])
    await loadNotes()
  }

  function startNewNote(type: "note" | "documentation") {
    const workspaceId = selectedWorkspaceId === "all" ? workspaces[0]?.id : Number(selectedWorkspaceId)
    setDraft({
      ...emptyDraft,
      workspaceId: workspaceId ? String(workspaceId) : "",
      docType: type,
    })
    setRevisions([])
    if (workspaceId) void loadProjects(workspaceId)
    scrollToEditor()
  }

  function updateWorkspace(value: string) {
    setDraft((current) => ({ ...current, workspaceId: value, projectId: "none", taskIds: [] }))
    void loadProjects(Number(value))
  }

  function toggleTask(taskId: number) {
    setDraft((current) => ({
      ...current,
      taskIds: current.taskIds.includes(taskId)
        ? current.taskIds.filter((id) => id !== taskId)
        : [...current.taskIds, taskId],
    }))
  }

  function applyFormat(prefix: string, suffix = prefix) {
    const textarea = document.getElementById("note-content") as HTMLTextAreaElement | null
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = draft.content.slice(start, end) || "text"
    const nextContent = `${draft.content.slice(0, start)}${prefix}${selected}${suffix}${draft.content.slice(end)}`
    setDraft((current) => ({ ...current, content: nextContent }))
    window.requestAnimationFrame(() => textarea.focus())
  }

  const filteredNotes = notes.filter((note) => {
    const query = searchQuery.toLowerCase()
    return !query || note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query) || note.projectName?.toLowerCase().includes(query)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notes & Docs</h1>
          <p className="text-muted-foreground">Create rich workspace notes, maintain project documentation, link tasks, and track revisions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => startNewNote("documentation")}><FileText className="h-4 w-4" />New Doc</Button>
          <Button onClick={() => startNewNote("note")}><Plus className="h-4 w-4" />New Note</Button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {liveNotice && <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{liveNotice}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Rich Notes" value={metrics.notes} icon={FileText} />
        <MetricCard title="Project Docs" value={metrics.docs} icon={ListChecks} />
        <MetricCard title="Task Linked" value={metrics.linked} icon={Link2} />
        <MetricCard title="Revisions" value={metrics.revisions} icon={History} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Library</CardTitle>
            <CardDescription>Search notes and documentation across accessible workspaces.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workspaces</SelectItem>
                  {workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="note">Notes</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search notes, docs, projects" />
              </div>
              <Button variant="outline" size="icon" onClick={() => loadNotes()}><RefreshCcw className="h-4 w-4" /></Button>
            </div>

            <ScrollArea className="h-[620px] pr-3">
              <div className="space-y-3">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading notes...</p>
                ) : filteredNotes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No notes found. Create a note or documentation page to get started.</div>
                ) : (
                  filteredNotes.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${draft.id === note.id ? "border-primary bg-primary/5" : "border-border"}`}
                      onClick={() => openNote(note.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{note.title}</div>
                          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{note.content || "Empty note"}</div>
                        </div>
                        <Badge variant={note.docType === "documentation" ? "default" : "secondary"}>{note.docType === "documentation" ? "Doc" : "Note"}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{note.workspaceName}</span>
                        {note.projectName && <span>{note.projectName}</span>}
                        <span>{note.linkedTasks} tasks</span>
                        <span>{note.revisions} revisions</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div ref={editorRef}>
        <Tabs defaultValue="editor" className="space-y-4">
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="links">Task Links</TabsTrigger>
            <TabsTrigger value="history">Revisions</TabsTrigger>
          </TabsList>

          <TabsContent value="editor">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{draft.id ? "Edit Note" : "Create New Note"}</CardTitle>
              <CardDescription>Capture ideas, document processes, or link notes to specific tasks.</CardDescription>
            </div>
            {Object.keys(viewers).length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {Object.entries(viewers).map(([id, info]) => (
                    <Avatar key={id} className="h-8 w-8 border-2 border-background ring-2 ring-primary/20">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">{info.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {Object.values(viewers).length} others {Object.values(viewers).some(v => v.status === "editing") ? "editing" : "viewing"}
                </span>
              </div>
            )}
          </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Workspace">
                    <Select value={draft.workspaceId} onValueChange={updateWorkspace} disabled={Boolean(draft.id)}>
                      <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                      <SelectContent>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Type">
                    <Select value={draft.docType} onValueChange={(value) => setDraft((current) => ({ ...current, docType: value as "note" | "documentation" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Rich Text Note</SelectItem>
                        <SelectItem value="documentation">Project Documentation</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
                  <Field label="Title">
                    <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Sprint plan, API guide, meeting notes" />
                  </Field>
                  <Field label="Project">
                    <Select value={draft.projectId} onValueChange={(value) => setDraft((current) => ({ ...current, projectId: value }))} disabled={!draft.workspaceId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Project</SelectItem>
                        {availableProjects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2 rounded-lg border border-border p-2">
                  <Button type="button" variant="ghost" size="icon" onClick={() => applyFormat("**")}><Bold className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => applyFormat("_")}><Italic className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => applyFormat("## ", "")}><FileText className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => applyFormat("- ", "")}><ListChecks className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => applyFormat("[", "](https://)")}> <Link2 className="h-4 w-4" /></Button>
                </div>
                <Textarea
                  id="note-content"
                  value={draft.content}
                  onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                  className="min-h-[420px] font-mono text-sm"
                  placeholder="Capture decisions, requirements, guides, and handoff details."
                />
                <div className="flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant={showPreview ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    <Eye className="h-4 w-4" />
                    {showPreview ? "Edit" : "Preview"}
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    {draft.id && <Button variant="ghost" onClick={deleteNote}><Trash2 className="h-4 w-4" />Delete</Button>}
                    <Button onClick={saveNote} disabled={isSaving || !draft.workspaceId || !draft.title.trim()}>
                      <Save className="h-4 w-4" />
                      {draft.id ? "Save Changes" : "Create Note"}
                    </Button>
                  </div>
                </div>
                {showPreview && (
                  <div className="rounded-lg border border-border p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.content) }} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="links">
            <Card>
              <CardHeader>
                <CardTitle>Linked Tasks</CardTitle>
                <CardDescription>Connect notes and documentation directly to workspace tasks.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!draft.workspaceId ? (
                  <p className="text-sm text-muted-foreground">Choose a workspace before linking tasks.</p>
                ) : availableTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks are available in this workspace.</p>
                ) : (
                  availableTasks.map((task) => {
                    const selected = draft.taskIds.includes(task.id)
                    return (
                      <button
                        key={task.id}
                        type="button"
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${selected ? "border-primary bg-primary/5" : "border-border"}`}
                        onClick={() => toggleTask(task.id)}
                      >
                        <div>
                          <div className="font-medium">{task.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{task.status} - {task.priority}</div>
                        </div>
                        <Badge variant={selected ? "default" : "outline"}>{selected ? "Linked" : "Link"}</Badge>
                      </button>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Revision History</CardTitle>
                <CardDescription>Every content save creates a revision snapshot.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {revisions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Save a note to start revision history.</p>
                ) : revisions.map((revision, index) => (
                  <div key={revision.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-medium">{revision.title}</div>
                        <div className="text-xs text-muted-foreground">{revision.editedByName ?? "Unknown user"} - {formatDateTime(revision.createdAt)}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDiffRevisionId(diffRevisionId === revision.id ? null : revision.id)}
                        >
                          {diffRevisionId === revision.id ? "Hide Diff" : "Show Diff"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setDraft((current) => ({ ...current, title: revision.title, content: revision.content })); toast.success("Revision restored to editor") }}>Restore</Button>
                      </div>
                    </div>
                    {diffRevisionId === revision.id && (
                      <div className="mt-3 rounded-md bg-muted/50 p-3 font-mono text-xs overflow-auto max-h-[300px]">
                        {renderDiff(
                          index < revisions.length - 1 ? revisions[index + 1].content : "",
                          revision.content
                        )}
                      </div>
                    )}
                    {diffRevisionId !== revision.id && (
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{revision.content || "Empty revision"}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
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

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function renderMarkdown(text: string): string {
  if (!text) return "<p class='text-muted-foreground'>Nothing to preview.</p>"

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Inline code
    .replace(/`(.+?)`/g, "<code class='bg-muted px-1 py-0.5 rounded text-sm'>$1</code>")
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline" target="_blank">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Paragraphs (double newlines)
    .replace(/\n\n/g, "</p><p>")
    // Single newlines
    .replace(/\n/g, "<br/>")
    // Wrap in paragraph
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
}

function renderDiff(oldText: string, newText: string) {
  const oldLines = (oldText || "").split("\n")
  const newLines = (newText || "").split("\n")
  const maxLen = Math.max(oldLines.length, newLines.length)
  const result: React.ReactNode[] = []

  // Simple line-by-line comparison
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)

  // Show removed lines first, then added
  for (let i = 0; i < maxLen; i++) {
    if (i < oldLines.length && !newSet.has(oldLines[i]) && oldLines[i].trim()) {
      result.push(
        <div key={`old-${i}`} className="text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
          - {oldLines[i]}
        </div>
      )
    }
    if (i < newLines.length && !oldSet.has(newLines[i]) && newLines[i].trim()) {
      result.push(
        <div key={`new-${i}`} className="text-green-500 bg-green-500/10 px-2 py-0.5 rounded">
          + {newLines[i]}
        </div>
      )
    }
    if (i < newLines.length && oldSet.has(newLines[i]) && newLines[i].trim()) {
      result.push(
        <div key={`same-${i}`} className="text-muted-foreground px-2 py-0.5">
          &nbsp; {newLines[i]}
        </div>
      )
    }
  }

  if (result.length === 0) {
    return <div className="text-muted-foreground">No differences found.</div>
  }

  return <>{result}</>
}

