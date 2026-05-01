"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Crown, Mail, Plus, Search, Shield, User } from "lucide-react"

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

const roleIcons = {
  owner: Crown,
  admin: Crown,
  member: User,
  viewer: Shield,
}

export default function TeamPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)

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

    loadTeam()
  }, [user])

  const filteredMembers = members.filter((member) =>
    `${member.name} ${member.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">Manage your team members and permissions</p>
        </div>
        <Button className="gap-2" disabled><Plus className="h-4 w-4" />Invite Member</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search team members..." className="pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{members.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Online Now</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{members.filter((member) => member.status === "online").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Tasks</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{members.reduce((total, member) => total + member.tasks, 0)}</div></CardContent></Card>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">Loading team...</CardContent></Card>
      ) : filteredMembers.length === 0 ? (
        <Card><CardContent className="p-6 text-muted-foreground">No team members found. Create a workspace to add yourself as the first member.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => {
            const RoleIcon = roleIcons[member.role] || User
            return (
              <Card key={member.id} className="transition-colors hover:bg-muted/50">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary">{member.name.split(" ").map((part) => part[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${member.status === "online" ? "bg-green-500" : member.status === "away" ? "bg-yellow-500" : "bg-muted-foreground"}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{member.name}</h3>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled><Mail className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
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

