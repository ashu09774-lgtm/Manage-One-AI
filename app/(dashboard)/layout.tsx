"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { cn } from "@/lib/utils"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function checkSession() {
      setMounted(true)
      const response = await fetch("/api/auth/me", { cache: "no-store" })

      if (!response.ok) {
        localStorage.removeItem("taskflow_user")
        router.push("/login")
        return
      }

      const data = await response.json()
      localStorage.setItem("taskflow_user", JSON.stringify(data.user))
      setAuthorized(true)
    }

    checkSession()
  }, [router])

  if (!mounted || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <a href="#dashboard-content" className="skip-link">Skip to content</a>
      <DashboardSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />
      <div
        className={cn(
          "flex min-w-0 flex-col transition-all duration-300",
          collapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        <DashboardHeader onMenuClick={() => setMobileSidebarOpen(true)} />
        <main id="dashboard-content" className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
