"use client"

import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      // Look for the dashboard scroll container or window
      const dashboardMain = document.getElementById("dashboard-content")
      
      if (dashboardMain) {
        if (dashboardMain.scrollTop > 300) {
          setIsVisible(true)
        } else {
          setIsVisible(false)
        }
      } else {
        if (window.scrollY > 300) {
          setIsVisible(true)
        } else {
          setIsVisible(false)
        }
      }
    }

    const dashboardMain = document.getElementById("dashboard-content")
    if (dashboardMain) {
      dashboardMain.addEventListener("scroll", toggleVisibility)
    } else {
      window.addEventListener("scroll", toggleVisibility)
    }

    return () => {
      if (dashboardMain) {
        dashboardMain.removeEventListener("scroll", toggleVisibility)
      } else {
        window.removeEventListener("scroll", toggleVisibility)
      }
    }
  }, [])

  const scrollToTop = () => {
    const dashboardMain = document.getElementById("dashboard-content")
    if (dashboardMain) {
      dashboardMain.scrollTo({
        top: 0,
        behavior: "smooth",
      })
    } else {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      })
    }
  }

  if (!isVisible) {
    return null
  }

  return (
    <Button
      variant="secondary"
      size="icon"
      className="fixed bottom-24 right-4 z-50 h-10 w-10 rounded-full border border-border shadow-md md:bottom-8 md:right-8"
      onClick={scrollToTop}
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  )
}
