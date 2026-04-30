"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Bot, CalendarClock, CheckSquare, Clock3, Play, RefreshCcw, Save, Sparkles, Trash2, Workflow } from "lucide-react"

interface UserData {
  id: string
}

interface WorkspaceOption {
  id: number
  name: string
}

interface Automation {
  id: number
  workspaceId: number
  name: string
  description: string | null
  triggerType: "task_overdue" | "task_due_soon" | "recurring_task" | "task_completed"
  actionType: "notify_assignee" | "notify_owner" | "create_task"
  config: Record<string, unknown>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

interface AutomationRun {
  id: number
  automationId: number
  automationName: string
  workspaceId: number
  status: "queued" | "running" | "success" | "failed"
  output: Record<string, unknown> | null
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

interface Suggestion {
  name: string
  description: string
  triggerType: Automation["triggerType"]
  actionType: Automation["actionType"]
  config: Record<string, unknown>
}

const emptyForm = {
  id: null as number | null,
  name: "",
  description: "",
  workspaceId: "",
  triggerType: "task_overdue" as Automation["triggerType"],
  actionType: "notify_assignee" as Automation["actionType"],
  enabled: true,
  daysAhead: "2",
  cadenceDays: "7",
  sourceTaskId: "",
  followUpTitle: "",
  followUpDescription: "",
  priority: "medium",
  status: "todo",
}

export default function AutomationsPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("all")
  const [automations, setAutomations] = useState<Automation[]>([])
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [form, setForm] = useState(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const storedUser = localStorage.getItem("taskflow_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void loadData()
  }, [user, selectedWorkspaceId])

  const filteredRuns = useMemo(() => {
    if (selectedWorkspaceId === "all") return runs
    return runs.filter((run) => String(run.workspaceId) === selectedWorkspaceId)
  }, [runs, selectedWorkspaceId])

  async function loadData() {
    if (!user?.id) return

    setIsLoading(true)
    setError("")
    try {
      const [workspaceResponse, automationResponse] = await Promise.all([
        fetch(`/api/workspaces?userId=${user.id}`),
        fetch(`/api/automations?userId=${user.id}${selectedWorkspaceId === "all" ? "" : `&workspaceId=${selectedWorkspaceId}`}`),
      ])

      const workspaceData = await workspaceResponse.json()
      const automationData = await automationResponse.json()

      if (!workspaceResponse.ok) throw new Error(workspaceData.error)
      if (!automationResponse.ok) throw new Error(automationData.error)

      setWorkspaces(workspaceData.workspaces.map((workspace: { id: number; name: string }) => ({
        id: workspace.id,
        name: workspace.name,
      })))
      setAutomations(automationData.automations)
      setRuns(automationData.runs)
      setSuggestions(automationData.suggestions ?? [])
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load automations")
    } finally {
      setIsLoading(false)
    }
  }

  async function saveAutomation() {
    if (!user?.id || !form.name.trim() || !form.workspaceId) return

    setIsSaving(true)
    setError("")
    const payload = {
      userId: user.id,
      workspaceId: Number(form.workspaceId),
      name: form.name,
      description: form.description,
      triggerType: form.triggerType,
      actionType: form.actionType,
      enabled: form.enabled,
      config: buildConfigFromForm(form),
    }

    const response = await fetch(form.id ? `/api/automations/${form.id}` : "/api/automations", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.id ? { ...payload, workspaceId: undefined } : payload),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not save automation")
      setIsSaving(false)
      return
    }

    if (form.id) {
      setAutomations((current) => current.map((item) => item.id === data.automation.id ? data.automation : item))
    } else {
      setAutomations((current) => [data.automation, ...current])
    }

    setForm(emptyForm)
    setIsSaving(false)
    await loadData()
  }

  async function deleteAutomation(id: number) {
    if (!user?.id) return

    const response = await fetch(`/api/automations/${id}?userId=${user.id}`, { method: "DELETE" })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not delete automation")
      return
    }

    setAutomations((current) => current.filter((item) => item.id !== id))
    if (form.id === id) setForm(emptyForm)
    await loadData()
  }

  async function runAutomationNow(id: number) {
    if (!user?.id) return

    const response = await fetch(`/api/automations/${id}/run?userId=${user.id}`, { method: "POST" })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not run automation")
      return
    }

    await loadData()
  }

  function editAutomation(automation: Automation) {
    setForm({
      id: automation.id,
      name: automation.name,
      description: automation.description ?? "",
      workspaceId: String(automation.workspaceId),
      triggerType: automation.triggerType,
      actionType: automation.actionType,
      enabled: automation.enabled,
      daysAhead: String(automation.config.daysAhead ?? 2),
      cadenceDays: String(automation.config.cadenceDays ?? 7),
      sourceTaskId: automation.config.sourceTaskId ? String(automation.config.sourceTaskId) : "",
      followUpTitle: String(automation.config.followUpTitle ?? ""),
      followUpDescription: String(automation.config.followUpDescription ?? ""),
      priority: String(automation.config.priority ?? "medium"),
      status: String(automation.config.status ?? "todo"),
    })
  }

  function applySuggestion(suggestion: Suggestion) {
    setForm({
      ...emptyForm,
      name: suggestion.name,
      description: suggestion.description,
      workspaceId: selectedWorkspaceId === "all" ? "" : selectedWorkspaceId,
      triggerType: suggestion.triggerType,
      actionType: suggestion.actionType,
      daysAhead: String(suggestion.config.daysAhead ?? 2),
      cadenceDays: String(suggestion.config.cadenceDays ?? 7),
      sourceTaskId: suggestion.config.sourceTaskId ? String(suggestion.config.sourceTaskId) : "",
      followUpTitle: String(suggestion.config.followUpTitle ?? ""),
      followUpDescription: String(suggestion.config.followUpDescription ?? ""),
      priority: String(suggestion.config.priority ?? "medium"),
      status: String(suggestion.config.status ?? "todo"),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automation</h1>
          <p className="text-muted-foreground">Build workflow rules, run them, and inspect every execution from one place.</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workspaces</SelectItem>
              {workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => loadData()}><RefreshCcw className="h-4 w-4" />Refresh</Button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Automation Rules" value={automations.length} icon={Workflow} />
        <MetricCard title="Enabled Rules" value={automations.filter((automation) => automation.enabled).length} icon={Sparkles} />
        <MetricCard title="Execution Logs" value={runs.length} icon={Clock3} />
        <MetricCard title="AI Suggestions" value={suggestions.length} icon={Bot} />
      </div>

      <Tabs defaultValue="builder" className="space-y-6">
        <TabsList>
          <TabsTrigger value="builder">Workflow Builder</TabsTrigger>
          <TabsTrigger value="rules">Automation Management</TabsTrigger>
          <TabsTrigger value="logs">Execution Logs</TabsTrigger>
          <TabsTrigger value="suggestions">Smart Suggestions</TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
          <Card>
            <CardHeader>
              <CardTitle>{form.id ? "Edit Automation" : "Create Automation"}</CardTitle>
              <CardDescription>Pick a trigger, choose an action, and shape the rule with the fields that matter for that recipe.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name">
                  <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <Field label="Workspace">
                  <Select value={form.workspaceId} onValueChange={(value) => setForm((current) => ({ ...current, workspaceId: value }))} disabled={Boolean(form.id)}>
                    <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                    <SelectContent>
                      {workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Description">
                <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24" />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Trigger">
                  <Select value={form.triggerType} onValueChange={(value) => setForm((current) => ({ ...current, triggerType: value as Automation["triggerType"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task_overdue">Task Overdue</SelectItem>
                      <SelectItem value="task_due_soon">Task Due Soon</SelectItem>
                      <SelectItem value="recurring_task">Recurring Task</SelectItem>
                      <SelectItem value="task_completed">Task Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Action">
                  <Select value={form.actionType} onValueChange={(value) => setForm((current) => ({ ...current, actionType: value as Automation["actionType"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notify_assignee">Notify Assignee</SelectItem>
                      <SelectItem value="notify_owner">Notify Owner</SelectItem>
                      <SelectItem value="create_task">Create Task</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">Rule Configuration</div>
                    <div className="text-sm text-muted-foreground">Fields adapt to the selected trigger and action.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Enabled</Label>
                    <Switch checked={form.enabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {form.triggerType === "task_due_soon" && (
                    <Field label="Days Ahead">
                      <Input type="number" min="1" value={form.daysAhead} onChange={(event) => setForm((current) => ({ ...current, daysAhead: event.target.value }))} />
                    </Field>
                  )}
                  {form.triggerType === "recurring_task" && (
                    <>
                      <Field label="Source Task ID">
                        <Input value={form.sourceTaskId} onChange={(event) => setForm((current) => ({ ...current, sourceTaskId: event.target.value }))} />
                      </Field>
                      <Field label="Cadence Days">
                        <Input type="number" min="1" value={form.cadenceDays} onChange={(event) => setForm((current) => ({ ...current, cadenceDays: event.target.value }))} />
                      </Field>
                    </>
                  )}
                  {form.triggerType === "task_completed" && (
                    <>
                      <Field label="Follow-up Title">
                        <Input value={form.followUpTitle} onChange={(event) => setForm((current) => ({ ...current, followUpTitle: event.target.value }))} />
                      </Field>
                      <Field label="Follow-up Status">
                        <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Follow-up Priority">
                        <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Follow-up Description">
                        <Textarea value={form.followUpDescription} onChange={(event) => setForm((current) => ({ ...current, followUpDescription: event.target.value }))} className="min-h-24" />
                      </Field>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {form.id && (
                  <Button variant="outline" onClick={() => setForm(emptyForm)}>
                    Cancel
                  </Button>
                )}
                <Button onClick={saveAutomation} disabled={isSaving || !form.name.trim() || !form.workspaceId}>
                  <Save className="h-4 w-4" />
                  {form.id ? "Save Changes" : "Create Automation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <div className="grid gap-4 lg:grid-cols-2">
            {isLoading ? (
              <Card><CardContent className="p-6 text-muted-foreground">Loading automations...</CardContent></Card>
            ) : automations.length === 0 ? (
              <Card className="lg:col-span-2"><CardContent className="p-6 text-muted-foreground">No automation rules yet. Create one from the builder or apply a smart suggestion.</CardContent></Card>
            ) : (
              automations.map((automation) => (
                <Card key={automation.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{automation.name}</CardTitle>
                        <CardDescription>{automation.description || "No description"}</CardDescription>
                      </div>
                      <Badge variant={automation.enabled ? "default" : "secondary"}>{automation.enabled ? "Enabled" : "Disabled"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{automation.triggerType}</Badge>
                      <Badge variant="outline">{automation.actionType}</Badge>
                      <Badge variant="secondary">Workspace {automation.workspaceId}</Badge>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(automation.config, null, 2)}</pre>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" onClick={() => editAutomation(automation)}>Edit</Button>
                      <Button variant="outline" onClick={() => runAutomationNow(automation.id)}>
                        <Play className="h-4 w-4" />
                        Run Now
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteAutomation(automation.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="space-y-4">
            {filteredRuns.length === 0 ? (
              <Card><CardContent className="p-6 text-muted-foreground">No automation runs yet. Execute a workflow to populate logs.</CardContent></Card>
            ) : (
              filteredRuns.map((run) => (
                <Card key={run.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{run.automationName}</div>
                        <div className="text-sm text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</div>
                      </div>
                      <Badge variant={run.status === "success" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>{run.status}</Badge>
                    </div>
                    {run.errorMessage && (
                      <div className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{run.errorMessage}</div>
                    )}
                    {run.output && (
                      <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                        <pre className="whitespace-pre-wrap">{JSON.stringify(run.output, null, 2)}</pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="suggestions">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {suggestions.length === 0 ? (
              <Card className="lg:col-span-2 xl:col-span-3"><CardContent className="p-6 text-muted-foreground">Choose a specific workspace to see AI-style workflow suggestions based on current tasks.</CardContent></Card>
            ) : (
              suggestions.map((suggestion) => (
                <Card key={`${suggestion.name}-${suggestion.triggerType}`}>
                  <CardHeader>
                    <CardTitle className="text-lg">{suggestion.name}</CardTitle>
                    <CardDescription>{suggestion.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{suggestion.triggerType}</Badge>
                      <Badge variant="outline">{suggestion.actionType}</Badge>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(suggestion.config, null, 2)}</pre>
                    </div>
                    <Button className="w-full" onClick={() => applySuggestion(suggestion)}>
                      <Sparkles className="h-4 w-4" />
                      Use Suggestion
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
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

function buildConfigFromForm(form: typeof emptyForm) {
  const config: Record<string, unknown> = {}

  if (form.triggerType === "task_due_soon") {
    config.daysAhead = Number(form.daysAhead || "2")
  }

  if (form.triggerType === "recurring_task") {
    if (form.sourceTaskId) config.sourceTaskId = Number(form.sourceTaskId)
    config.cadenceDays = Number(form.cadenceDays || "7")
  }

  if (form.triggerType === "task_completed") {
    if (form.followUpTitle.trim()) config.followUpTitle = form.followUpTitle.trim()
    if (form.followUpDescription.trim()) config.followUpDescription = form.followUpDescription.trim()
    config.priority = form.priority
    config.status = form.status
  }

  return config
}
