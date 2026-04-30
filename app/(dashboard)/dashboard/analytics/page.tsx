"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertCircle, BarChart3, CheckCircle, Clock, Download, RefreshCcw, Sparkles, TrendingUp, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

interface UserData {
  id: string
}

interface WorkspaceOption {
  id: number
  name: string
}

interface AnalyticsData {
  filters: {
    workspaceId: number | null
    rangeDays: number
  }
  metrics: {
    totalTasks: number
    completedTasks: number
    overdueTasks: number
    openTasks: number
    inProgressTasks: number
    completionRate: number
    avgCompletionHours: number
  }
  weeklyData: Array<{ day: string; tasks: number; completed: number }>
  completionGraph: Array<{ label: string; date: string; created: number; completed: number }>
  workspaceStats: Array<{ id: number; name: string; completed: number; total: number; overdue: number; percentage: number }>
  teamPerformance: Array<{ id: number; name: string; email: string; assigned: number; completed: number; overdue: number; completionRate: number }>
  priorityBreakdown: Array<{ priority: string; total: number; completed: number }>
  insights: Array<{ title: string; body: string; tone: "positive" | "warning" | "danger" | "muted" }>
  exportRows: Array<{ section: string; name: string; value: string | number }>
}

const priorityColors: Record<string, string> = {
  urgent: "var(--destructive)",
  high: "var(--chart-1)",
  medium: "var(--chart-2)",
  low: "var(--chart-3)",
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [workspaceId, setWorkspaceId] = useState("all")
  const [range, setRange] = useState("30")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const storedUser = localStorage.getItem("taskflow_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void loadWorkspaces()
  }, [user])

  useEffect(() => {
    if (!user?.id) return
    void loadAnalytics()
  }, [user, workspaceId, range])

  const metrics = data?.metrics ?? {
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    openTasks: 0,
    inProgressTasks: 0,
    completionRate: 0,
    avgCompletionHours: 0,
  }

  const hasData = Boolean(data && (metrics.totalTasks > 0 || data.workspaceStats.length > 0 || data.teamPerformance.length > 0))
  const maxTeamAssigned = useMemo(() => Math.max(1, ...(data?.teamPerformance.map((member) => member.assigned) ?? [1])), [data])

  async function loadWorkspaces() {
    if (!user?.id) return
    const response = await fetch(`/api/workspaces?userId=${user.id}`)
    const payload = await response.json()
    if (response.ok) setWorkspaces(payload.workspaces.map((workspace: WorkspaceOption) => ({ id: workspace.id, name: workspace.name })))
  }

  async function loadAnalytics() {
    if (!user?.id) return

    setIsLoading(true)
    setError("")
    const params = new URLSearchParams({ userId: user.id, range })
    if (workspaceId !== "all") params.set("workspaceId", workspaceId)

    try {
      const response = await fetch(`/api/analytics?${params.toString()}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setData(payload)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load analytics")
    } finally {
      setIsLoading(false)
    }
  }

  function exportReport() {
    if (!data) return

    const rows = [
      ["section", "name", "value"],
      ...data.exportRows.map((row) => [row.section, row.name, String(row.value)]),
    ]
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `taskflow-analytics-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Track productivity, task completion, team performance, and AI-style insights.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={workspaceId} onValueChange={setWorkspaceId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workspaces</SelectItem>
              {workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => loadAnalytics()}><RefreshCcw className="h-4 w-4" />Refresh</Button>
          <Button onClick={exportReport} disabled={!data}><Download className="h-4 w-4" />Export CSV</Button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="Completed" value={metrics.completedTasks} icon={CheckCircle} tone="text-green-500" loading={isLoading} />
        <MetricCard title="Total Tasks" value={metrics.totalTasks} icon={Clock} tone="text-blue-500" loading={isLoading} />
        <MetricCard title="Open" value={metrics.openTasks} icon={BarChart3} tone="text-cyan-500" loading={isLoading} />
        <MetricCard title="In Progress" value={metrics.inProgressTasks} icon={TrendingUp} tone="text-violet-500" loading={isLoading} />
        <MetricCard title="Overdue" value={metrics.overdueTasks} icon={AlertCircle} tone="text-red-500" loading={isLoading} />
        <MetricCard title="Completion" value={`${metrics.completionRate}%`} icon={Sparkles} tone="text-primary" loading={isLoading} />
      </div>

      {!isLoading && !hasData ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No analytics data yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Add tasks, complete work, or choose a wider date range to populate the productivity dashboard.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.3fr,0.7fr]">
            <Card>
              <CardHeader>
                <CardTitle>Task Completion Graph</CardTitle>
                <CardDescription>Created and completed tasks across the selected date range.</CardDescription>
              </CardHeader>
              <CardContent className="h-[340px]">
                {isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.completionGraph ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="created" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="completed" stroke="var(--primary)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Insights</CardTitle>
                <CardDescription>Heuristic recommendations based on current workspace data.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <InsightSkeleton />
                ) : data?.insights.length ? (
                  data.insights.map((insight) => <InsightCard key={insight.title} insight={insight} />)
                ) : (
                  <p className="text-sm text-muted-foreground">No insights available for this filter.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Progress</CardTitle>
                <CardDescription>Completion rate and overdue risk by workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {isLoading ? <ListSkeleton /> : data?.workspaceStats.length ? data.workspaceStats.map((workspace) => (
                  <div key={workspace.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{workspace.name}</div>
                        <div className="text-xs text-muted-foreground">{workspace.completed}/{workspace.total} complete</div>
                      </div>
                      <Badge variant={workspace.overdue > 0 ? "destructive" : workspace.percentage >= 60 ? "default" : "secondary"}>
                        {workspace.overdue > 0 ? `${workspace.overdue} overdue` : `${workspace.percentage}%`}
                      </Badge>
                    </div>
                    <Progress value={workspace.percentage} className="h-2" />
                  </div>
                )) : <p className="text-sm text-muted-foreground">No workspace data for this filter.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Priority Breakdown</CardTitle>
                <CardDescription>Task distribution by priority and completion state.</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                {isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.priorityBreakdown ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="priority" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {(data?.priorityBreakdown ?? []).map((entry) => <Cell key={entry.priority} fill={priorityColors[entry.priority] ?? "var(--primary)"} />)}
                      </Bar>
                      <Bar dataKey="completed" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Activity</CardTitle>
                <CardDescription>Recent created and completed task volume.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.weeklyData ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="tasks" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.18} />
                      <Area type="monotone" dataKey="completed" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.22} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team Performance</CardTitle>
                <CardDescription>Assigned work, completion, and deadline risk by teammate.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? <ListSkeleton /> : data?.teamPerformance.length ? data.teamPerformance.map((member) => (
                  <div key={member.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate font-medium">{member.name}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{member.completed}/{member.assigned} completed</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{member.completionRate}%</Badge>
                        {member.overdue > 0 && <Badge variant="destructive">{member.overdue} overdue</Badge>}
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded bg-muted">
                      <div className="h-2 rounded bg-primary" style={{ width: `${(member.assigned / maxTeamAssigned) * 100}%` }} />
                    </div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No team performance data for this filter.</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, tone, loading }: { title: string; value: string | number; icon: React.ElementType; tone: string; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${tone}`} />
      </CardHeader>
      <CardContent>{loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{value}</div>}</CardContent>
    </Card>
  )
}

function InsightCard({ insight }: { insight: AnalyticsData["insights"][number] }) {
  const variant = insight.tone === "danger" ? "destructive" : insight.tone === "positive" ? "default" : "secondary"
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="font-medium">{insight.title}</div>
        <Badge variant={variant}>{insight.tone}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{insight.body}</p>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
    </div>
  )
}

function InsightSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 w-full" />)}
    </div>
  )
}

function escapeCsv(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`
}
