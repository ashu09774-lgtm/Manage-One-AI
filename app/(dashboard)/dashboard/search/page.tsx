"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Bookmark, Brain, CheckSquare, FileText, FolderKanban, Search, SlidersHorizontal, Sparkles, Trash2, Zap } from "lucide-react"

interface UserData {
  id: string
}

interface SearchResult {
  id: number
  type: "task" | "project" | "workspace" | "note"
  title: string
  description: string | null
  workspaceId: number | null
  workspaceName: string | null
  href: string
  meta: Record<string, string | number | null>
  score: number
}

interface WorkspaceOption {
  id: number
  name: string
}

interface SavedView {
  id: number
  name: string
  filters: {
    query: string
    type: string
    workspaceId: string
    status: string
    priority: string
    smart: string
  }
}

interface SearchPayload {
  query: string
  results: SearchResult[]
  counts: {
    all: number
    tasks: number
    projects: number
    workspaces: number
    notes: number
  }
  workspaces: WorkspaceOption[]
  smartFilters: Array<{ id: string; label: string; count: number }>
  semanticSummary: string
}

const emptyPayload: SearchPayload = {
  query: "",
  results: [],
  counts: {
    all: 0,
    tasks: 0,
    projects: 0,
    workspaces: 0,
    notes: 0,
  },
  workspaces: [],
  smartFilters: [],
  semanticSummary: "Search across your workspace data.",
}

const resultIcons = {
  task: CheckSquare,
  project: FolderKanban,
  workspace: Zap,
  note: FileText,
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const [user, setUser] = useState<UserData | null>(null)
  const [query, setQuery] = useState(searchParams.get("q") ?? "")
  const [type, setType] = useState(searchParams.get("type") ?? "all")
  const [workspaceId, setWorkspaceId] = useState(searchParams.get("workspaceId") ?? "all")
  const [status, setStatus] = useState("all")
  const [priority, setPriority] = useState("all")
  const [smart, setSmart] = useState("all")
  const [data, setData] = useState<SearchPayload>(emptyPayload)
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingView, setIsSavingView] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const storedUser = localStorage.getItem("manageone_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const timeout = window.setTimeout(() => {
      void runSearch()
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [user, query, type, workspaceId, status, priority, smart])

  useEffect(() => {
    if (!user?.id) return
    void loadSavedViews()
  }, [user])

  const topResults = useMemo(() => data.results.slice(0, 6), [data.results])

  async function loadSavedViews() {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/views?userId=${user.id}`)
      const payload = await response.json()
      if (response.ok) setSavedViews(payload.views)
    } catch (err) {
      console.error("Failed to load saved views", err)
    }
  }

  async function saveCurrentView() {
    if (!user?.id) return
    const name = window.prompt("Enter a name for this view:")
    if (!name?.trim()) return

    setIsSavingView(true)
    try {
      const response = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          name: name.trim(),
          filters: { query, type, workspaceId, status, priority, smart },
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)

      setSavedViews((current) => [payload.view, ...current])
      toast.success("View saved successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save view")
    } finally {
      setIsSavingView(false)
    }
  }

  function applySavedView(view: SavedView) {
    const { filters } = view
    setQuery(filters.query || "")
    setType(filters.type || "all")
    setWorkspaceId(filters.workspaceId || "all")
    setStatus(filters.status || "all")
    setPriority(filters.priority || "all")
    setSmart(filters.smart || "all")
    toast.success(`Applied view: ${view.name}`)
  }

  async function deleteSavedView(id: number) {
    if (!user?.id || !window.confirm("Are you sure you want to delete this view?")) return

    try {
      const response = await fetch(`/api/views/${id}?userId=${user.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete view")

      setSavedViews((current) => current.filter((v) => v.id !== id))
      toast.success("View deleted")
    } catch (err) {
      toast.error("Could not delete view")
    }
  }

  async function runSearch() {
    if (!user?.id) return

    setIsLoading(true)
    setError("")
    const params = new URLSearchParams({
      userId: user.id,
      q: query,
      type,
      status,
      priority,
      smart,
    })
    if (workspaceId !== "all") params.set("workspaceId", workspaceId)

    const response = await fetch(`/api/search?${params.toString()}`, { cache: "no-store" })
    const payload = await response.json()
    setIsLoading(false)

    if (!response.ok) {
      setError(payload.error ?? "Could not search")
      return
    }

    setData(payload)
  }

  function applySmartFilter(value: string) {
    setSmart((current) => current === value ? "all" : value)
  }

  function resetFilters() {
    setType("all")
    setWorkspaceId("all")
    setStatus("all")
    setPriority("all")
    setSmart("all")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search & Smart Filters</h1>
          <p className="text-muted-foreground">Find tasks, projects, workspaces, notes, and docs with intent-aware filters.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveCurrentView} disabled={isSavingView}>
            <Bookmark className="mr-2 h-4 w-4" />
            Save View
          </Button>
          <Button variant="outline" onClick={resetFilters}><SlidersHorizontal className="mr-2 h-4 w-4" />Reset Filters</Button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks, projects, workspaces, notes, docs, labels, owners..."
              className="h-12 pl-11 text-base"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                  <SelectItem value="project">Projects</SelectItem>
                  <SelectItem value="workspace">Workspaces</SelectItem>
                  <SelectItem value="note">Notes & Docs</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Workspace">
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workspaces</SelectItem>
                  {data.workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Task Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Status</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Semantic Intent">
              <Select value={smart} onValueChange={setSmart}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Intent</SelectItem>
                  <SelectItem value="assigned_to_me">Assigned to Me</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="due_soon">Due Soon</SelectItem>
                  <SelectItem value="high_priority">High Priority</SelectItem>
                  <SelectItem value="docs">Documentation</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        <CountCard title="All" value={data.counts.all} active={type === "all"} onClick={() => setType("all")} />
        <CountCard title="Tasks" value={data.counts.tasks} active={type === "task"} onClick={() => setType("task")} />
        <CountCard title="Projects" value={data.counts.projects} active={type === "project"} onClick={() => setType("project")} />
        <CountCard title="Workspaces" value={data.counts.workspaces} active={type === "workspace"} onClick={() => setType("workspace")} />
        <CountCard title="Notes & Docs" value={data.counts.notes} active={type === "note"} onClick={() => setType("note")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.75fr,1.25fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />AI Semantic Search</CardTitle>
              <CardDescription>Keyword scoring plus context from labels, priorities, docs, and workspace names.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">{data.semanticSummary}</div>
              <div className="space-y-2">
                {data.smartFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${smart === filter.id ? "border-primary bg-primary/5" : "border-border"}`}
                    onClick={() => applySmartFilter(filter.id)}
                  >
                    <span className="font-medium">{filter.label}</span>
                    <Badge variant={smart === filter.id ? "default" : "secondary"}>{filter.count}</Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bookmark className="h-5 w-5" />Saved Views</CardTitle>
              <CardDescription>Your personal list of frequently used search and filter combinations.</CardDescription>
            </CardHeader>
            <CardContent>
              {savedViews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved views yet. Use "Save View" above to store your filters.</p>
              ) : (
                <div className="space-y-2">
                  {savedViews.map((view) => (
                    <div
                      key={view.id}
                      className="group flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-2 text-left"
                        onClick={() => applySavedView(view)}
                      >
                        <Bookmark className="h-4 w-4 text-primary" />
                        <span className="font-medium">{view.name}</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteSavedView(view.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Top Matches</CardTitle>
              <CardDescription>The highest-scoring results for the current query.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <ListSkeleton />
              ) : topResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No top matches yet.</p>
              ) : topResults.map((result) => <CompactResult key={`${result.type}-${result.id}`} result={result} />)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Global Results</CardTitle>
            <CardDescription>Unified search across tasks, projects, workspaces, notes, and documentation pages.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[760px] pr-3">
              {isLoading ? (
                <ListSkeleton large />
              ) : data.results.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <h2 className="font-semibold">No results found</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Try a broader keyword, reset filters, or search by workspace, label, priority, project, note title, or documentation text.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.results.map((result) => <SearchResultCard key={`${result.type}-${result.id}`} result={result} />)}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
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

function CountCard({ title, value, active, onClick }: { title: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${active ? "border-primary bg-primary/5" : "border-border"}`}>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-sm text-muted-foreground">{title}</p>
    </button>
  )
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const Icon = resultIcons[result.type]
  return (
    <Link href={result.href} className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{result.title}</span>
            <Badge variant="secondary">{result.type}</Badge>
          </div>
          {result.description && <p className="line-clamp-2 text-sm text-muted-foreground">{result.description}</p>}
          <ResultMeta result={result} />
        </div>
        <Badge variant="outline">Score {result.score}</Badge>
      </div>
    </Link>
  )
}

function CompactResult({ result }: { result: SearchResult }) {
  const Icon = resultIcons[result.type]
  return (
    <Link href={result.href} className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{result.title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{result.workspaceName ?? result.type}</div>
      </div>
    </Link>
  )
}

function ResultMeta({ result }: { result: SearchResult }) {
  const entries = Object.entries(result.meta).filter(([, value]) => value !== null && value !== "")
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      {result.workspaceName && <span>{result.workspaceName}</span>}
      {entries.slice(0, 5).map(([key, value]) => <span key={key}>{key}: {String(value)}</span>)}
    </div>
  )
}

function ListSkeleton({ large = false }: { large?: boolean }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: large ? 8 : 4 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}
    </div>
  )
}

