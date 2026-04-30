"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Zap,
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Workflow,
  Users,
  MessageSquare,
  FileText,
  Bot,
  BarChart3,
  Search,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell
} from "lucide-react"
import { useState } from "react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Workspaces", href: "/dashboard/workspaces", icon: FolderKanban },
  { name: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { name: "Team", href: "/dashboard/team", icon: Users },
  { name: "Collaboration", href: "/dashboard/collaboration", icon: MessageSquare },
  { name: "Notes & Docs", href: "/dashboard/notes", icon: FileText },
  { name: "AI Assistant", href: "/dashboard/assistant", icon: Bot },
  { name: "Automation", href: "/dashboard/automations", icon: Workflow },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Search", href: "/dashboard/search", icon: Search },
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell },
]

const secondaryNav = [
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "Help", href: "/dashboard/help", icon: HelpCircle },
]

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  mobileOpen?: boolean
  setMobileOpen?: (open: boolean) => void
}

export function DashboardSidebar({ collapsed, setCollapsed, mobileOpen = false, setMobileOpen }: SidebarProps) {
  const pathname = usePathname()
  const closeMobile = () => setMobileOpen?.(false)

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeMobile}
      />
      <aside
        aria-label="Dashboard navigation"
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-sidebar transition-transform duration-300 md:z-40 md:transition-all",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-64"
        )}
      >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={closeMobile}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className={cn("text-lg font-bold", collapsed && "md:hidden")}>TaskFlow AI</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 md:inline-flex"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* New Workspace Button */}
      <div className="p-3">
        <Button 
          className={cn("w-full gap-2", collapsed && "md:px-0")}
          size={collapsed ? "icon" : "default"}
          asChild
        >
          <Link href="/dashboard/workspaces" onClick={closeMobile} aria-label="Create or manage workspaces">
            <Plus className="h-4 w-4" />
            <span className={cn(collapsed && "md:hidden")}>New Workspace</span>
          </Link>
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={closeMobile}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  collapsed && "md:justify-center md:px-0"
                )}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className={cn(collapsed && "md:hidden")}>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Secondary Navigation */}
        <div className="mt-6 border-t border-border pt-6">
          <nav className="space-y-1">
            {secondaryNav.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeMobile}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    collapsed && "md:justify-center md:px-0"
                  )}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className={cn(collapsed && "md:hidden")}>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <div className={cn("flex items-center gap-2", collapsed && "md:justify-center")}>
          <ThemeToggle />
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link href="/dashboard/notifications" aria-label="Open notifications" onClick={closeMobile}>
                <Bell className="h-5 w-5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </aside>
    </>
  )
}
