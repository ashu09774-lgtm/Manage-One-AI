"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowRight, Calendar, FolderKanban, Plus, Search } from "lucide-react"

interface Workspace {
  id: number
  name: string
  description: string | null
  color: string
  tasks: number
  completedTasks: number
  members: number
  lastUpdated: string
}

interface UserData {
  id: string
}

export default function WorkspacesPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const storedUser = localStorage.getItem("manageone_user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return

    async function loadWorkspaces() {
      setIsLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/workspaces?userId=${user!.id}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setWorkspaces(data.workspaces)
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not load workspaces")
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkspaces()
  }, [user])

  const filteredWorkspaces = workspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim() || !user?.id) return

    setError("")
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        name: newWorkspaceName,
        description: newWorkspaceDesc,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not create workspace")
      return
    }

    setWorkspaces((current) => [data.workspace, ...current])
    setNewWorkspaceName("")
    setNewWorkspaceDesc("")
    setDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground">Organize your projects and collaborate with your team</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
              <DialogDescription>Add a new workspace to organize your projects</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Workspace Name</Label>
                <Input id="name" value={newWorkspaceName} onChange={(event) => setNewWorkspaceName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={newWorkspaceDesc} onChange={(event) => setNewWorkspaceDesc(event.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateWorkspace}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search workspaces..." className="pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">Loading workspaces...</CardContent></Card>
      ) : filteredWorkspaces.length === 0 ? (
        <Card><CardContent className="p-6 text-muted-foreground">No workspaces yet. Create one to start adding tasks.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWorkspaces.map((workspace) => {
            const progress = Math.round((workspace.completedTasks / workspace.tasks) * 100) || 0
            return (
              <Card key={workspace.id} className="transition-all hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${workspace.color}`}>
                      <FolderKanban className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">{workspace.name}</CardTitle>
                      <CardDescription className="line-clamp-1">{workspace.description || "No description"}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">{workspace.completedTasks} of {workspace.tasks} tasks completed</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 border-2 border-card">
                        <AvatarFallback className="text-[10px]">{workspace.members}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{workspace.members} members</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <Calendar className="mr-1 h-3 w-3" />
                      {workspace.lastUpdated}
                    </Badge>
                  </div>
                  <Link href={`/dashboard/workspaces/${workspace.id}`}>
                    <Button variant="outline" className="w-full gap-2">
                      Open Workspace
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

