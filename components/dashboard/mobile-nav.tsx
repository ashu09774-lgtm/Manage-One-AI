"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckSquare, FolderKanban, LayoutDashboard, Settings } from "lucide-react"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/dashboard/tasks", icon: CheckSquare, label: "Tasks" },
  { href: "/dashboard/workspaces", icon: FolderKanban, label: "Projects" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full border-t border-border/40 bg-background/40 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around p-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`) && item.href !== "/dashboard"
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 px-4 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
      {/* Safe area padding for iOS */}
      <div className="h-safe-area-bottom" />
    </div>
  )
}
