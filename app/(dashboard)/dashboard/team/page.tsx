"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Crown, Mail, Plus, Search, Shield, User, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface UserData {
  id: string
}

interface Member {
  id: number
  name: string
  email: string
  role: "owner" | "admin" | "member" | "viewer"
  status: "online" | "away" | "offline"
  tasks: number
}

interface Workspace {
  id: number
  name: string
}

const roleIcons = {
  owner: Crown,
  admin: Crown,
  member: User,
  viewer: Shield,
}

export default function TeamPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: "",
    workspaceId: "",
    role: "member",
  })

  useEffect(() => {
    const storedUser = localStorage.getItem("manageone_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id) return

    async function loadTeam() {
      setIsLoading(true)
      const response = await fetch(`/api/team?userId=${user!.id}`)
      const data = await response.json()
      setMembers(response.ok ? data.members : [])
      setIsLoading(false)
    }

    async function loadWorkspaces() {
      const response = await fetch(`/api/workspaces?userId=${user!.id}`)
      const data = await response.json()
      if (response.ok) {
        setWorkspaces(data.workspaces)
        if (data.workspaces.length > 0) {
          setInviteForm(prev => ({ ...prev, workspaceId: String(data.workspaces[0].id) }))
        }
      }
    }

    void loadTeam()
    void loadWorkspaces()
  }, [user])

  async function handleInvite() {
    if (!user?.id || !inviteForm.email || !inviteForm.workspaceId) return

    setIsInviting(true)
    try {
      const response = await fetch(`/api/workspaces/${inviteForm.workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: inviteForm.email,
          role: inviteForm.role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? "Failed to invite member")
        return
      }

      toast.success("Invitation sent successfully!")
      setIsInviteOpen(false)
      setInviteForm({ email: "", workspaceId: workspaces[0]?.id ? String(workspaces[0].id) : "", role: "member" })
      
      // Refresh team list
      const teamResponse = await fetch(`/api/team?userId=${user.id}`)
      const teamData = await teamResponse.json()
      if (teamResponse.ok) setMembers(teamData.members)
      
    } catch (error) {
      toast.error("An error occurred during invitation")
    } finally {
      setIsInviting(false)
    }
  }

  const filteredMembers = members.filter((member) =>
    `${member.name} ${member.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">Manage your team members and permissions</p>
        </div>
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your workspace. They will receive an email to accept.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  placeholder="name@example.com"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="workspace">Workspace</Label>
                <Select
                  value={inviteForm.workspaceId}
                  onValueChange={(value) => setInviteForm({ ...inviteForm, workspaceId: value })}
                >
                  <SelectTrigger id="workspace">
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={String(ws.id)}>
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteOpen(false)} disabled={isInviting}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={isInviting || !inviteForm.email || !inviteForm.workspaceId}>
                {isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Invite Member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search team members..." className="pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <TeamStat title="Total Members" value={members.length} />
        <TeamStat title="Online Now" value={members.filter((member) => member.status === "online").length} />
        <TeamStat title="Active Tasks" value={members.reduce((total, member) => total + member.tasks, 0)} />
      </div>

      {isLoading ? (
        <Card className="py-0"><CardContent className="p-4 text-muted-foreground">Loading team...</CardContent></Card>
      ) : filteredMembers.length === 0 ? (
        <Card className="py-0"><CardContent className="p-4 text-muted-foreground">No team members found. Create a workspace to add yourself as the first member.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredMembers.map((member) => {
            const RoleIcon = roleIcons[member.role] || User
            return (
              <Card key={member.id} className="py-0 transition-colors hover:bg-muted/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary">{member.name.split(" ").map((part) => part[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${member.status === "online" ? "bg-green-500" : member.status === "away" ? "bg-yellow-500" : "bg-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{member.name}</h3>
                        <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled><Mail className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="secondary" className="gap-1"><RoleIcon className="h-3 w-3" />{member.role}</Badge>
                    <span className="text-sm text-muted-foreground">{member.tasks} active tasks</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TeamStat({ title, value }: { title: string; value: number }) {
  return (
    <Card className="py-0 shadow-sm">
      <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
        <CardTitle className="text-xs font-medium leading-4 text-muted-foreground sm:text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
        <div className="text-xl font-bold sm:text-2xl">{value}</div>
      </CardContent>
    </Card>
  )
}

