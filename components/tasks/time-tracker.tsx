"use client"

import React, { useEffect, useState } from "react"
import { Play, Square, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface TimeTrackerProps {
  taskId: number
  userId: number
}

interface TimeData {
  totalSeconds: number
  activeTimer: { id: number; startTime: string } | null
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export function TimeTracker({ taskId, userId }: TimeTrackerProps) {
  const [data, setData] = useState<TimeData | null>(null)
  const [elapsedActive, setElapsedActive] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/time?userId=${userId}`)
      if (response.ok) {
        const json = await response.json()
        setData({
          totalSeconds: json.totalSeconds,
          activeTimer: json.activeTimer,
        })
        if (json.activeTimer) {
          // Calculate elapsed since start
          const start = new Date(json.activeTimer.startTime).getTime()
          const now = new Date().getTime()
          // Convert from UTC string assuming the server returned local time or standard format.
          // For safety, let's just use simple diff.
          // Note: If timezone issues occur, we might need a safer parsing.
          // Assuming UTC for now.
          const diffSeconds = Math.floor((now - new Date(json.activeTimer.startTime + "Z").getTime()) / 1000)
          setElapsedActive(diffSeconds > 0 ? diffSeconds : 0)
        } else {
          setElapsedActive(0)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [taskId, userId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!data?.activeTimer) return

    const interval = setInterval(() => {
      setElapsedActive(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [data?.activeTimer])

  async function toggleTimer() {
    setIsLoading(true)
    const action = data?.activeTimer ? "stop" : "start"
    try {
      const response = await fetch(`/api/tasks/${taskId}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      })
      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error ?? `Could not ${action} timer`)
        return
      }

      toast.success(action === "start" ? "Timer started" : "Timer stopped")
      await loadData()
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
        <span className="text-sm text-muted-foreground">Loading time...</span>
      </div>
    )
  }

  const isRunning = !!data?.activeTimer
  const totalDisplay = (data?.totalSeconds || 0) + elapsedActive

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button
          variant={isRunning ? "destructive" : "outline"}
          size="sm"
          className="gap-2 w-[100px]"
          onClick={toggleTimer}
          disabled={isLoading}
        >
          {isRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isRunning ? "Stop" : "Start"}
        </Button>
        <div className="flex items-center gap-2 tabular-nums">
          <Clock className={`h-4 w-4 ${isRunning ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          <span className={`text-lg font-mono ${isRunning ? "font-bold text-primary" : "font-medium"}`}>
            {formatDuration(totalDisplay)}
          </span>
        </div>
      </div>
    </div>
  )
}
