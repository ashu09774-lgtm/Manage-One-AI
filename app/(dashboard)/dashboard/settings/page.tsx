"use client"

import { useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Bell, FolderKanban, Palette, Save, Shield, Trash2, User, Users } from "lucide-react"
import { DeleteWorkspaceDialog } from "@/components/workspace/delete-workspace-dialog"

interface UserData {
  id?: string
  name: string
  email: string
}

interface WorkspaceOption {
  id: number
  name: string
  description: string | null
  color: string
}

interface WorkspaceMember {
  id: number
  name: string
  email: string
  role: "owner" | "admin" | "member" | "viewer"
  status: "online" | "away" | "offline"
  tasks: number
}

const workspaceColors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"]

export default function SettingsPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [taskReminders, setTaskReminders] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [workspaceDescription, setWorkspaceDescription] = useState("")
  const [workspaceColor, setWorkspaceColor] = useState("bg-blue-500")
  const [workspaceRole, setWorkspaceRole] = useState("")
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [deleteWorkspaceOpen, setDeleteWorkspaceOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const storedUser = localStorage.getItem("manageone_user")
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      setUser(parsed)
      setName(parsed.name)
      setEmail(parsed.email)
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void loadUserSettings()
    void loadWorkspaces()
  }, [user])

  useEffect(() => {
    if (!user?.id || !selectedWorkspaceId) return
    void loadWorkspaceSettings(Number(selectedWorkspaceId))
    void loadWorkspaceMembers(Number(selectedWorkspaceId))
  }, [user, selectedWorkspaceId])

  const canManageWorkspace = ["owner", "admin"].includes(workspaceRole)
  const initials = useMemo(() => name ? name.split(" ").map((part) => part[0]).join("").toUpperCase() : "U", [name])

  async function loadUserSettings() {
    if (!user?.id) return
    const response = await fetch(`/api/users/${user.id}`)
    const data = await response.json()
    if (!response.ok) return

    setName(data.user.name)
    setEmail(data.user.email)
    setEmailNotifications(Boolean(data.user.emailNotifications))
    setPushNotifications(Boolean(data.user.pushNotifications))
    setTaskReminders(Boolean(data.user.taskReminders))
    setWeeklyDigest(Boolean(data.user.weeklyDigest))
    setTwoFactorEnabled(Boolean(data.user.twoFactorEnabled))
    setTheme(data.user.theme ?? "dark")
  }

  async function loadWorkspaces() {
    if (!user?.id) return
    const response = await fetch(`/api/workspaces?userId=${user.id}`)
    const data = await response.json()
    if (!response.ok) return
    setWorkspaces(data.workspaces)
    if (!selectedWorkspaceId && data.workspaces[0]) {
      setSelectedWorkspaceId(String(data.workspaces[0].id))
    }
  }

  async function loadWorkspaceSettings(workspaceId: number) {
    if (!user?.id) return
    const response = await fetch(`/api/workspaces/${workspaceId}?userId=${user.id}`)
    const data = await response.json()
    if (!response.ok) return
    setWorkspaceName(data.workspace.name)
    setWorkspaceDescription(data.workspace.description ?? "")
    setWorkspaceColor(data.workspace.color)
    setWorkspaceRole(data.workspace.role)
  }

  async function loadWorkspaceMembers(workspaceId: number) {
    if (!user?.id) return
    const response = await fetch(`/api/workspaces/${workspaceId}/members?userId=${user.id}`)
    const data = await response.json()
    if (!response.ok) return
    setMembers(data.members)
    setWorkspaceRole(data.role)
  }

  async function saveAccountSettings() {
    if (!user?.id) return
    setIsSaving(true)
    setMessage("")
    setError("")

    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        theme: theme ?? "dark",
        emailNotifications,
        pushNotifications,
        taskReminders,
        weeklyDigest,
      }),
    })
    const data = await response.json()

    if (response.ok) {
      const updatedUser = { ...user, ...data.user, name, email }
      localStorage.setItem("manageone_user", JSON.stringify(updatedUser))
      setUser(updatedUser)
      setMessage("Account settings saved.")
    } else {
      setError(data.error ?? "Could not save account settings.")
    }

    setIsSaving(false)
  }

  async function saveWorkspaceSettings() {
    if (!user?.id || !selectedWorkspaceId) return
    setIsSaving(true)
    setMessage("")
    setError("")

    const response = await fetch(`/api/workspaces/${selectedWorkspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        name: workspaceName,
        description: workspaceDescription,
        color: workspaceColor,
      }),
    })
    const data = await response.json()
    setIsSaving(false)

    if (!response.ok) {
      setError(data.error ?? "Could not save workspace settings.")
      return
    }

    setWorkspaces((current) => current.map((workspace) => workspace.id === Number(selectedWorkspaceId) ? { ...workspace, ...data.workspace } : workspace))
    setMessage("Workspace settings saved.")
  }

  async function updateMemberRole(memberId: number, role: WorkspaceMember["role"]) {
    if (!user?.id || !selectedWorkspaceId || role === "owner") return
    const response = await fetch(`/api/workspaces/${selectedWorkspaceId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, role }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not update member role.")
      return
    }
    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role } : member))
    setMessage("Member role updated.")
  }

  async function removeMember(memberId: number) {
    if (!user?.id || !selectedWorkspaceId) return
    const response = await fetch(`/api/workspaces/${selectedWorkspaceId}/members/${memberId}?userId=${user.id}`, { method: "DELETE" })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? "Could not remove member.")
      return
    }
    setMembers((current) => current.filter((member) => member.id !== memberId))
    setMessage("Member removed.")
  }

  async function saveSecuritySettings() {
    if (!user?.id) return
    setIsSaving(true)
    setMessage("")
    setError("")

    const response = await fetch(`/api/users/${user.id}/security`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    })
    const data = await response.json()
    setIsSaving(false)

    if (!response.ok) {
      setError(data.error ?? "Could not update password.")
      return
    }

    setCurrentPassword("")
    setNewPassword("")
    setMessage("Password updated.")
  }

  async function toggleTwoFactor(nextValue: boolean) {
    if (!user?.id) return
    setTwoFactorEnabled(nextValue)
    await fetch(`/api/users/${user.id}/security`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twoFactorEnabled: nextValue }),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage profile, workspace, team, security, appearance, and notification preferences.</p>
      </div>

      {message && <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{message}</div>}
      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" />Profile</TabsTrigger>
          <TabsTrigger value="workspace" className="gap-2"><FolderKanban className="h-4 w-4" />Workspace</TabsTrigger>
          <TabsTrigger value="team" className="gap-2"><Users className="h-4 w-4" />Team</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2"><Palette className="h-4 w-4" />Appearance</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield className="h-4 w-4" />Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Management</CardTitle>
              <CardDescription>Update your display name, email address, and account identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20"><AvatarFallback className="bg-primary/10 text-2xl text-primary">{initials}</AvatarFallback></Avatar>
                <div>
                  <div className="font-medium">{name || "User"}</div>
                  <p className="text-sm text-muted-foreground">{email || "No email set"}</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
                <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
              </div>
              <Button onClick={saveAccountSettings} disabled={isSaving}><Save className="h-4 w-4" />Save Profile</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Settings</CardTitle>
              <CardDescription>Update workspace identity, description, and color when you have admin access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Field label="Workspace">
                <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                  <SelectContent>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Workspace Name"><Input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} disabled={!canManageWorkspace} /></Field>
                <Field label="Role"><Input value={workspaceRole || "member"} disabled /></Field>
              </div>
              <Field label="Description"><Textarea value={workspaceDescription} onChange={(event) => setWorkspaceDescription(event.target.value)} disabled={!canManageWorkspace} className="min-h-24" /></Field>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {workspaceColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-9 w-9 rounded-md border ${color} ${workspaceColor === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"}`}
                      onClick={() => setWorkspaceColor(color)}
                      disabled={!canManageWorkspace}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={saveWorkspaceSettings} disabled={isSaving || !canManageWorkspace}><Save className="h-4 w-4" />Save Workspace</Button>
              {workspaceRole === "owner" && (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteWorkspaceOpen(true)}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Workspace
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team Permissions</CardTitle>
              <CardDescription>Review members and adjust roles for the selected workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Workspace">
                <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                  <SelectContent>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <ScrollArea className="h-[520px] pr-3">
                <div className="space-y-3">
                  {members.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No members found.</div>
                  ) : members.map((member) => (
                    <div key={member.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.name}</span>
                          <Badge variant={member.status === "online" ? "default" : "secondary"}>{member.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email} - {member.tasks} open tasks</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={member.role} onValueChange={(value) => updateMemberRole(member.id, value as WorkspaceMember["role"])} disabled={!canManageWorkspace || member.role === "owner"}>
                          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
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
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Choose how reminders, assignments, automation alerts, and summaries reach you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <PreferenceRow title="Email Notifications" description="Allow important alerts by email." checked={emailNotifications} onChange={setEmailNotifications} />
              <Separator />
              <PreferenceRow title="Push Notifications" description="Receive live in-app updates while working." checked={pushNotifications} onChange={setPushNotifications} />
              <Separator />
              <PreferenceRow title="Task Reminders" description="Generate reminders for upcoming and overdue work." checked={taskReminders} onChange={setTaskReminders} />
              <Separator />
              <PreferenceRow title="Weekly Digest" description="Prepare a weekly activity and notification summary." checked={weeklyDigest} onChange={setWeeklyDigest} />
              <Button onClick={saveAccountSettings} disabled={isSaving}><Save className="h-4 w-4" />Save Notifications</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Theme Toggle</CardTitle>
              <CardDescription>Set your preferred visual theme for the dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                {["light", "dark", "system"].map((option) => (
                  <Button key={option} variant={theme === option ? "default" : "outline"} className="justify-start capitalize" onClick={() => setTheme(option)}>
                    {option}
                  </Button>
                ))}
              </div>
              <Button onClick={saveAccountSettings} disabled={isSaving}><Save className="h-4 w-4" />Save Appearance</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Change your password and manage additional account security preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Current Password"><Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
                <Field label="New Password"><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
              </div>
              <Button onClick={saveSecuritySettings} disabled={isSaving || !currentPassword || !newPassword}>Update Password</Button>
              <Separator />
              <PreferenceRow title="Two-Factor Authentication" description="Track whether this account should require a second factor when supported by your deployment." checked={twoFactorEnabled} onChange={toggleTwoFactor} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedWorkspaceId && (
        <DeleteWorkspaceDialog
          open={deleteWorkspaceOpen}
          onOpenChange={setDeleteWorkspaceOpen}
          workspaceId={Number(selectedWorkspaceId)}
          workspaceName={workspaceName}
        />
      )}
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

function PreferenceRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

