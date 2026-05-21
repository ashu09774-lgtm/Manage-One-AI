"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Menu, Search, Bell, LogOut, User, Settings } from "lucide-react"
import { useEffect, useState } from "react"
import { useUser } from "@/components/user-provider"



interface NotificationItem {
  id: number
  type: string
  title: string
  body: string | null
  createdAt: string
  readAt: string | null
}

export function DashboardHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter()
  const { user } = useUser()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (!user?.id) return

    async function loadNotifications() {
      const response = await fetch(`/api/notifications?userId=${user!.id}`, { cache: "no-store" })
      const data = await response.json()

      if (!response.ok) return

      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    }

    loadNotifications()
  }, [user])

  useEffect(() => {
    if (!user?.id) return

    const eventSource = new EventSource(`/api/notifications/stream?userId=${user.id}`)
    eventSource.addEventListener("notification", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        title: string
        body: string | null
        type: string
        createdAt: string
      }

      setNotifications((current) => [
        {
          id: Date.now(),
          title: payload.title,
          body: payload.body,
          type: payload.type,
          createdAt: payload.createdAt,
          readAt: null,
        },
        ...current,
      ].slice(0, 12))
      setUnreadCount((current) => current + 1)
    })

    return () => eventSource.close()
  }, [user])

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      try { localStorage.removeItem("manageone_user") } catch { /* ignore */ }
      router.push("/")
    })
  }

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchQuery.trim()
    router.push(query ? `/dashboard/search?q=${encodeURIComponent(query)}` : "/dashboard/search")
  }

  const markAllRead = async () => {
    if (!user?.id || unreadCount === 0) return

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: user.id, markAllRead: true }),
    })

    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })))
    setUnreadCount(0)
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "U"

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={onMenuClick} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </Button>


      {/* Search */}
      <form className="relative min-w-0 flex-1 sm:max-w-md group" onSubmit={handleSearch}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input
          type="search"
          placeholder="Search tasks, projects, notes..."
          className="w-full pl-10 rounded-xl border-border/40 bg-background/50 backdrop-blur-md focus-visible:ring-primary/30 transition-all duration-300"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </form>
      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Open notifications">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[calc(100vw-2rem)] p-0 sm:w-96" align="end">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Notifications</p>
                <p className="text-xs text-muted-foreground">Recent updates from your workspace</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={markAllRead}>
                Mark all read
              </Button>
            </div>
            <ScrollArea className="max-h-80">
              <div className="divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No notifications yet.</div>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{item.title}</p>
                          {item.body && <p className="text-xs text-muted-foreground">{item.body}</p>}
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.type}</p>
                        </div>
                        {!item.readAt && <span className="mt-1 h-2 w-2 rounded-full bg-primary" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full" aria-label="Open user menu">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || "user@example.com"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
              <User className="mr-2 h-4 w-4" />
              Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

