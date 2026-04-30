"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Bot, CheckSquare, Clock, FolderKanban, Plus, TrendingUp, Users } from "lucide-react"

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

const priorityVariant = {
  low: "secondary",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
} as const

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const storedUser = localStorage.getItem("taskflow_user")
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {user?.name?.split(" ")[0] || "User"}
          </h1>
          <p className="text-muted-foreground">Here is what is happening with your workspace today.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/assistant">
            <Button variant="outline" className="gap-2"><Bot className="h-4 w-4" />AI Assistant</Button>
          </Link>
          <Link href="/dashboard/tasks">
            <Button className="gap-2"><Plus className="h-4 w-4" />New Task</Button>
          </Link>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active Workspaces" value={stats.workspaces} icon={FolderKanban} />
        <MetricCard title="Total Tasks" value={stats.tasks} icon={CheckSquare} />
        <MetricCard title="Team Members" value={stats.members} icon={Users} />
        <MetricCard title="Completion Rate" value={`${stats.completionRate}%`} icon={TrendingUp} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
            <CardDescription>Your latest task updates from the database</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading tasks...</p>
            ) : !data?.recentTasks.length ? (
              <p className="text-muted-foreground">No tasks yet. Create your first task to populate this view.</p>
            ) : (
              <div className="space-y-4">
                {data.recentTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${task.status === "done" ? "bg-green-500" : task.status === "in-progress" ? "bg-blue-500" : "bg-muted-foreground"}`} />
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">{task.workspace}</p>
                      </div>
                    </div>
                    <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Activity</CardTitle>
            <CardDescription>Recent activity from workspace events</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading activity...</p>
            ) : !data?.activity.length ? (
              <div className="flex items-start gap-3 text-muted-foreground">
                <Avatar className="h-8 w-8"><AvatarFallback>DB</AvatarFallback></Avatar>
                <div>
                  <p className="text-sm">No activity events have been recorded yet.</p>
                  <p className="mt-1 flex items-center text-xs"><Clock className="mr-1 h-3 w-3" />This panel updates as tasks and workspaces change.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {data.activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{item.user.split(" ").map((part) => part[0]).join("").slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">{item.user}</span>{" "}
                        <span className="text-muted-foreground">{item.action}</span>{" "}
                        <span className="font-medium">{item.subject}</span>
                      </p>
                      <p className="flex items-center text-xs text-muted-foreground">
                        <Clock className="mr-1 h-3 w-3" />
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

      <Card>
        <CardHeader>
          <CardTitle>Active Workspaces</CardTitle>
          <CardDescription>Progress across your real workspaces</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.projects.length ? (
            <p className="text-muted-foreground">No workspaces yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.projects.map((project) => (
                <div key={project.id} className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">{project.name}</h3>
                    <span className="text-sm text-muted-foreground">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="mb-3 h-2" />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{project.tasks} tasks</span>
                    <span>{project.members} members</span>
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

function MetricCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
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
