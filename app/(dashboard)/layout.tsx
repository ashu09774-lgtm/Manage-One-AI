"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { MobileNav } from "@/components/dashboard/mobile-nav"
import { UserProvider, useUser } from "@/components/user-provider"
import { CommandPalette } from "@/components/ui/command-palette"
import { cn } from "@/lib/utils"

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const router = useRouter()
  const { user, isLoading } = useUser()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    router.push("/login")
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Premium background orbs */}
      <div className="gradient-orb gradient-orb-1 top-[-10%] left-[-10%] animate-pulse-glow" />
      <div className="gradient-orb gradient-orb-2 bottom-[-10%] right-[-10%] animate-float-slow" />
      
      <a href="#dashboard-content" className="skip-link">Skip to content</a>
      <DashboardSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />
      <div
        className={cn(
          "relative z-10 flex min-w-0 flex-col transition-all duration-300",
          collapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        <DashboardHeader onMenuClick={() => setMobileSidebarOpen(true)} />
        <main id="dashboard-content" className="flex-1 p-4 pb-20 sm:p-6 sm:pb-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProvider>
      <DashboardShell>{children}</DashboardShell>
      <CommandPalette />
    </UserProvider>
  )
}
