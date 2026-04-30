"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Bell, BellRing, CheckCheck, Clock, RefreshCcw, Settings, Trash2, Workflow } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

interface UserData {
  id: string
}

interface NotificationItem {
  id: number
  type: string
  title: string
  body: string | null
  entityType: string | null
  entityId: number | null
  createdAt: string
  readAt: string | null
}

interface NotificationPayload {
  notifications: NotificationItem[]
  unreadCount: number
  summary: {
    total: number
    unread: number
    deadlineUnread: number
    assignmentUnread: number
    automationUnread: number
  }
  preferences: {
    emailNotifications: boolean
    pushNotifications: boolean
    taskReminders: boolean
    weeklyDigest: boolean
  }
}

const emptyPayload: NotificationPayload = {
  notifications: [],
  unreadCount: 0,
  summary: {
    total: 0,
    unread: 0,
    deadlineUnread: 0,
    assignmentUnread: 0,
    automationUnread: 0,
  },
  preferences: {
    emailNotifications: true,
    pushNotifications: true,
    taskReminders: true,
    weeklyDigest: false,
  },
}

export default function NotificationsPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [data, setData] = useState<NotificationPayload>(emptyPayload)
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const storedUser = localStorage.getItem("taskflow_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void loadNotifications()
  }, [user, typeFilter, statusFilter])

  useEffect(() => {
    if (!user?.id) return

    const eventSource = new EventSource(`/api/notifications/stream?userId=${user.id}`)
    eventSource.addEventListener("notification", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as NotificationItem
      setData((current) => ({
        ...current,
        notifications: [payload, ...current.notifications].slice(0, 100),
        unreadCount: current.unreadCount + 1,
        summary: {
          ...current.summary,
          total: current.summary.total + 1,
          unread: current.summary.unread + 1,
          deadlineUnread: payload.type === "deadline" ? current.summary.deadlineUnread + 1 : current.summary.deadlineUnread,
          assignmentUnread: payload.type === "assignment" ? current.summary.assignmentUnread + 1 : current.summary.assignmentUnread,
          automationUnread: payload.type === "automation" ? current.summary.automationUnread + 1 : current.summary.automationUnread,
        },
      }))
    })

    return () => eventSource.close()
  }, [user])

  const preferences = data.preferences
  const unreadByType = useMemo(() => [
    { title: "In-app unread", value: data.summary.unread, icon: BellRing },
    { title: "Deadline reminders", value: data.summary.deadlineUnread, icon: Clock },
    { title: "Assignment alerts", value: data.summary.assignmentUnread, icon: AlertCircle },
    { title: "Automation alerts", value: data.summary.automationUnread, icon: Workflow },
  ], [data.summary])

  async function loadNotifications() {
    if (!user?.id) return

    setIsLoading(true)
    setError("")
    const params = new URLSearchParams({
      userId: user.id,
      type: typeFilter,
      status: statusFilter,
      limit: "100",
    })

    const response = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Could not load notifications")
      setIsLoading(false)
      return
    }

    setData(payload)
    setIsLoading(false)
  }

  async function markAllRead() {
    if (!user?.id) return
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, markAllRead: true }),
    })
    await loadNotifications()
  }

  async function markOneRead(notificationId: number) {
    if (!user?.id) return
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, notificationId }),
    })
    setData((current) => ({
      ...current,
      notifications: current.notifications.map((item) => item.id === notificationId ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item),
      unreadCount: Math.max(0, current.unreadCount - 1),
      summary: { ...current.summary, unread: Math.max(0, current.summary.unread - 1) },
    }))
  }

  async function clearNotification(notificationId: number) {
    if (!user?.id) return
    await fetch(`/api/notifications?userId=${user.id}&notificationId=${notificationId}`, { method: "DELETE" })
    setData((current) => ({
      ...current,
      notifications: current.notifications.filter((item) => item.id !== notificationId),
    }))
  }

  async function clearRead() {
    if (!user?.id) return
    await fetch(`/api/notifications?userId=${user.id}&clear=read`, { method: "DELETE" })
    await loadNotifications()
  }

  async function generateReminders() {
    if (!user?.id) return

    setMessage("")
    setError("")
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, action: "generate_reminders" }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Could not generate reminders")
      return
    }

    setMessage(`${payload.created} notification${payload.created === 1 ? "" : "s"} generated.`)
    await loadNotifications()
  }

  async function savePreferences() {
    if (!user?.id) return

    setIsSaving(true)
    setMessage("")
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, preferences }),
    })
    const payload = await response.json()
    setIsSaving(false)

    if (!response.ok) {
      setError(payload.error ?? "Could not save preferences")
      return
    }

    setMessage("Notification preferences saved.")
  }

  function updatePreference(key: keyof NotificationPayload["preferences"], value: boolean) {
    setData((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Review alerts, generate reminders, and manage how updates reach you.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => loadNotifications()}><RefreshCcw className="h-4 w-4" />Refresh</Button>
          <Button variant="outline" onClick={generateReminders}><Bell className="h-4 w-4" />Run Reminder Check</Button>
          <Button onClick={markAllRead} disabled={data.unreadCount === 0}><CheckCheck className="h-4 w-4" />Mark All Read</Button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {message && <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{message}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        {unreadByType.map((item) => <MetricCard key={item.title} title={item.title} value={item.value} icon={item.icon} loading={isLoading} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Notification Center</CardTitle>
                <CardDescription>Filter in-app notifications and clear items when they are handled.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="deadline">Deadlines</SelectItem>
                    <SelectItem value="assignment">Assignments</SelectItem>
                    <SelectItem value="automation">Automation</SelectItem>
                    <SelectItem value="mention">Mentions</SelectItem>
                    <SelectItem value="task">Tasks</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[660px] pr-3">
              {isLoading ? (
                <div className="space-y-3">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24 w-full" />)}</div>
              ) : data.notifications.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <h2 className="font-semibold">No notifications found</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Try another filter or run the reminder check to create deadline, assignment, and automation alerts.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.notifications.map((notification) => (
                    <div key={notification.id} className={`rounded-lg border p-4 ${notification.readAt ? "border-border" : "border-primary bg-primary/5"}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={notification.readAt ? "secondary" : "default"}>{notification.type}</Badge>
                            {!notification.readAt && <Badge variant="outline">Unread</Badge>}
                            <span className="text-xs text-muted-foreground">{formatDateTime(notification.createdAt)}</span>
                          </div>
                          <div>
                            <div className="font-medium">{notification.title}</div>
                            {notification.body && <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!notification.readAt && (
                            <Button variant="outline" size="sm" onClick={() => markOneRead(notification.id)}>Read</Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => clearNotification(notification.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={clearRead}><Trash2 className="h-4 w-4" />Clear Read</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Preferences</CardTitle>
            <CardDescription>These settings control notification delivery preferences for your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PreferenceRow
              title="In-app push updates"
              description="Receive live browser updates while the app is open."
              checked={preferences.pushNotifications}
              onChange={(value) => updatePreference("pushNotifications", value)}
            />
            <Separator />
            <PreferenceRow
              title="Email notifications"
              description="Allow important alerts to be delivered by email."
              checked={preferences.emailNotifications}
              onChange={(value) => updatePreference("emailNotifications", value)}
            />
            <Separator />
            <PreferenceRow
              title="Deadline reminders"
              description="Generate alerts for overdue and upcoming assigned tasks."
              checked={preferences.taskReminders}
              onChange={(value) => updatePreference("taskReminders", value)}
            />
            <Separator />
            <PreferenceRow
              title="Weekly digest"
              description="Include a weekly summary of notification and task activity."
              checked={preferences.weeklyDigest}
              onChange={(value) => updatePreference("weeklyDigest", value)}
            />
            <Button onClick={savePreferences} disabled={isSaving} className="w-full">
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, loading }: { title: string; value: number; icon: React.ElementType; loading: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          {loading ? <Skeleton className="mb-2 h-8 w-16" /> : <div className="text-2xl font-bold">{value}</div>}
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

function PreferenceRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="font-medium">{title}</Label>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
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
