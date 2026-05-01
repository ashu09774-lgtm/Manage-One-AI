"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CheckSquare,
  Clock,
  FolderKanban,
  Layers,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { AnimatedCard } from "@/components/ui/animated-card"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"


interface UserData {
  id: string
  name: string
}

interface DashboardData {
  stats: {
    workspaces: number
    tasks: number
    members: number
    completionRate: number
  }
  recentTasks: Array<{
    id: number
    title: string
    status: string
    priority: "low" | "medium" | "high" | "urgent"
    workspace: string
  }>
  projects: Array<{
    id: number
    name: string
    progress: number
    tasks: number
    members: number
  }>
  activity: Array<{
    id: number
    user: string
    action: string
    subject: string
    createdAt: string
  }>
}

const priorityConfig = {
  low: { variant: "secondary" as const, className: "bg-muted text-muted-foreground" },
  medium: { variant: "secondary" as const, className: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  high: { variant: "default" as const, className: "bg-primary/10 text-primary border-primary/20" },
  urgent: { variant: "destructive" as const, className: "bg-destructive/10 text-destructive border-destructive/20" },
}

const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
  todo: { label: "To Do", dot: "bg-muted-foreground", bg: "bg-muted/50 text-muted-foreground" },
  "in-progress": { label: "In Progress", dot: "bg-blue-500", bg: "bg-blue-500/10 text-blue-400" },
  review: { label: "Review", dot: "bg-amber-500", bg: "bg-amber-500/10 text-amber-400" },
  done: { label: "Done", dot: "bg-emerald-500", bg: "bg-emerald-500/10 text-emerald-400" },
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const storedUser = localStorage.getItem("manageone_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id) return

    async function loadDashboard() {
      setIsLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/dashboard?userId=${user!.id}`)
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error)
        setData(payload)
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not load dashboard")
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboard()
  }, [user])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  const stats = data?.stats ?? { workspaces: 0, tasks: 0, members: 0, completionRate: 0 }

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-primary/20 via-chart-2/10 to-chart-3/5 p-8 shadow-2xl animate-gradient-shift">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/20 blur-[100px] animate-pulse-glow" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-chart-2/20 blur-[100px] animate-float-slow" />
        
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Intelligence Layer Active
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                {greeting()}, <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">{user?.name?.split(" ")[0] || "User"}</span> 👋
              </h1>
              <p className="mt-3 max-w-xl text-lg text-muted-foreground/80 leading-relaxed">
                Your workspace is optimized and synchronized. You have <span className="font-bold text-foreground">{stats.tasks} tasks</span> pending across <span className="font-bold text-foreground">{stats.workspaces} workspaces</span>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/assistant">
              <Button size="lg" variant="outline" className="gap-2 rounded-2xl border-primary/20 bg-background/50 text-primary backdrop-blur-md hover:bg-primary/10 hover:border-primary/40 transition-all duration-300">
                <Bot className="h-5 w-5" />
                Assistant
              </Button>
            </Link>
            <Link href="/dashboard/tasks">
              <Button size="lg" className="gap-2 rounded-2xl bg-primary shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-500 group">
                <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
                Quick Task
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Workspaces"
          value={stats.workspaces}
          icon={FolderKanban}
          gradient="from-primary/10 to-primary/5"
          iconBg="bg-primary/10 text-primary"
          isLoading={isLoading}
          className="animate-slide-up stagger-1"
        />
        <MetricCard
          title="Total Tasks"
          value={stats.tasks}
          icon={CheckSquare}
          gradient="from-chart-2/10 to-chart-2/5"
          iconBg="bg-chart-2/10 text-chart-2"
          isLoading={isLoading}
          className="animate-slide-up stagger-2"
        />
        <MetricCard
          title="Team Members"
          value={stats.members}
          icon={Users}
          gradient="from-chart-5/10 to-chart-5/5"
          iconBg="bg-chart-5/10 text-chart-5"
          isLoading={isLoading}
          className="animate-slide-up stagger-3"
        />
        <MetricCard
          title="Completion Rate"
          value={`${stats.completionRate}%`}
          icon={TrendingUp}
          gradient="from-chart-3/10 to-chart-3/5"
          iconBg="bg-chart-3/10 text-chart-3"
          isLoading={isLoading}
          showProgress
          progressValue={stats.completionRate}
          trend="↑ 5% from last week"
          className="animate-slide-up stagger-4"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Tasks */}
        <Card className="card-glow lg:col-span-2 overflow-hidden border-border/40 bg-card/40 backdrop-blur-xl transition-all duration-500">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/30 pb-6">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Layers className="h-4 w-4 text-primary" />
                </div>
                Recent Tasks
              </CardTitle>
              <CardDescription className="mt-1">Latest task updates across your workspaces</CardDescription>
            </div>
            <Link href="/dashboard/tasks">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-muted/30 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-muted" />
                      <div className="space-y-2">
                        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                    <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            ) : !data?.recentTasks.length ? (
              <EmptyState 
                icon={CheckSquare}
                title="No tasks yet"
                description="Create your first task to start tracking your work and see progress here."
                action={
                  <Link href="/dashboard/tasks">
                    <Button size="sm" className="gap-1.5 rounded-lg">
                      <Plus className="h-3.5 w-3.5" />
                      Create First Task
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                {data.recentTasks.map((task) => {
                  const status = statusConfig[task.status] ?? statusConfig.todo
                  const priority = priorityConfig[task.priority] ?? priorityConfig.medium
                  return (
                    <div
                      key={task.id}
                      className="group flex items-center justify-between rounded-xl border border-border/40 bg-background/50 p-3.5 transition-all duration-200 hover:border-border hover:bg-muted/30 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${status.dot} ring-4 ring-background`} />
                        <div className="min-w-0">
                          <p className="truncate font-medium group-hover:text-primary transition-colors">{task.title}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{task.workspace}</span>
                            <span className="text-border">·</span>
                            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${status.bg}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={priority.variant} className={`ml-2 flex-shrink-0 rounded-md border text-[11px] ${priority.className}`}>
                        {task.priority}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Activity */}
        <Card className="card-glow overflow-hidden border-border/40 bg-card/40 backdrop-blur-xl transition-all duration-500">
          <CardHeader className="border-b border-border/30 pb-6">
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-chart-5/10">
                <Zap className="h-4 w-4 text-chart-5" />
              </div>
              Activity
            </CardTitle>
            <CardDescription>Recent workspace events</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
                      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !data?.activity.length ? (
              <EmptyState 
                icon={Clock}
                title="No activity yet"
                description="Activity events will appear here as tasks and workspaces change."
              />
            ) : (
              <div className="space-y-4">
                {data.activity.map((item) => (
                  <div key={item.id} className="group flex items-start gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted/20">
                    <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-chart-2/20 text-xs font-semibold">
                        {item.user.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{item.user}</span>{" "}
                        <span className="text-muted-foreground">{item.action}</span>{" "}
                        <span className="font-medium text-primary">{item.subject}</span>
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Workspaces */}
      <Card className="card-glow overflow-hidden border-border/40 bg-card/40 backdrop-blur-xl transition-all duration-500">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/30 pb-6">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-chart-2/10">
                <FolderKanban className="h-4 w-4 text-chart-2" />
              </div>
              Active Workspaces
            </CardTitle>
            <CardDescription className="mt-1">Progress across your workspaces</CardDescription>
          </div>
          <Link href="/dashboard/workspaces">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
              Manage <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border/40 bg-muted/10 p-5">
                  <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
                  <div className="mb-4 h-2 w-full animate-pulse rounded-full bg-muted" />
                  <div className="flex justify-between">
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.projects.length ? (
            <EmptyState 
              icon={FolderKanban}
              title="No workspaces yet"
              description="Create a workspace to organize your projects, tasks, and team collaboration."
              action={
                <Link href="/dashboard/workspaces">
                  <Button size="sm" className="gap-1.5 rounded-lg">
                    <Plus className="h-3.5 w-3.5" />
                    Create Workspace
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.projects.map((project) => (
                <div
                  key={project.id}
                  className="group relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-card to-background/50 p-5 transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-primary/5"
                >
                  {/* Top gradient accent */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold group-hover:text-primary transition-colors">{project.name}</h3>
                    <span className="flex items-center gap-1 text-sm font-bold text-primary">
                      {project.progress}%
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </div>

                  {/* Custom gradient progress bar */}
                  <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-700 ease-out"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {project.tasks} tasks
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {project.members} members
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  gradient,
  iconBg,
  isLoading,
  showProgress,
  progressValue,
  trend,
  className,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  gradient: string
  iconBg: string
  isLoading: boolean
  showProgress?: boolean
  progressValue?: number
  trend?: string
  className?: string
}) {
  return (
    <Card className={cn(`card-glow group relative overflow-hidden bg-gradient-to-br h-full transition-all duration-500 hover:scale-[1.02] ${gradient}`, className)}>
      {/* Hover glow line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
        ) : (
          <>
            <div className="text-3xl font-bold tracking-tight flex items-end gap-2">
              {value}
              {trend && (
                <span className="text-xs font-medium text-emerald-500 mb-1">{trend}</span>
              )}
            </div>
            {showProgress && progressValue !== undefined && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-chart-3 to-chart-3/60 transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(progressValue, 100)}%` }}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000))

  if (diffMinutes < 60) return `${diffMinutes} min ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hr ago`

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
}

