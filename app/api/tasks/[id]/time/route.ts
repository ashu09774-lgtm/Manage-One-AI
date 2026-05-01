import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { badRequest, serverError } from "@/lib/api-utils"
import type { RowDataPacket, ResultSetHeader } from "mysql2"

// Get all time logs for a task
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskId = Number(id)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!taskId || !userId) {
      return badRequest("Missing task or user id")
    }

    const [taskRows] = await db.execute<RowDataPacket[]>(
      `SELECT t.id
      FROM tasks t
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.id = ?
      LIMIT 1`,
      [userId, taskId]
    )

    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const [logs] = await db.execute<RowDataPacket[]>(
      `SELECT
        l.id,
        l.user_id AS userId,
        u.name AS userName,
        DATE_FORMAT(l.start_time, '%Y-%m-%d %H:%i:%s') AS startTime,
        DATE_FORMAT(l.end_time, '%Y-%m-%d %H:%i:%s') AS endTime,
        l.duration_seconds AS durationSeconds
      FROM task_time_logs l
      INNER JOIN users u ON u.id = l.user_id
      WHERE l.task_id = ?
      ORDER BY l.start_time DESC`,
      [taskId]
    )

    // Calculate total
    const totalSeconds = logs.reduce((acc, log) => acc + (Number(log.durationSeconds) || 0), 0)

    // Check if there is an active timer for this user
    const [activeRows] = await db.execute<RowDataPacket[]>(
      `SELECT
        id,
        DATE_FORMAT(start_time, '%Y-%m-%d %H:%i:%s') AS startTime
      FROM task_time_logs
      WHERE task_id = ? AND user_id = ? AND end_time IS NULL
      LIMIT 1`,
      [taskId, userId]
    )

    return NextResponse.json({
      logs: logs.map(log => ({
        id: Number(log.id),
        userId: Number(log.userId),
        userName: String(log.userName),
        startTime: String(log.startTime),
        endTime: log.endTime ? String(log.endTime) : null,
        durationSeconds: log.durationSeconds ? Number(log.durationSeconds) : null,
      })),
      totalSeconds,
      activeTimer: activeRows.length > 0 ? {
        id: Number(activeRows[0].id),
        startTime: String(activeRows[0].startTime)
      } : null
    })
  } catch (error) {
    console.error("Fetch time logs failed:", error)
    return serverError("Could not load time logs")
  }
}

// Start or stop a timer
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskId = Number(id)
    const { userId, action } = await request.json()

    if (!taskId || !userId || !["start", "stop"].includes(action)) {
      return badRequest("Invalid parameters")
    }

    const [taskRows] = await db.execute<RowDataPacket[]>(
      `SELECT t.workspace_id
      FROM tasks t
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.id = ?
      LIMIT 1`,
      [userId, taskId]
    )

    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (action === "start") {
      // Check for existing active timer
      const [activeRows] = await db.execute<RowDataPacket[]>(
        "SELECT id FROM task_time_logs WHERE task_id = ? AND user_id = ? AND end_time IS NULL LIMIT 1",
        [taskId, userId]
      )

      if (activeRows.length > 0) {
        return badRequest("Timer is already running for this task")
      }

      await db.execute(
        "INSERT INTO task_time_logs (task_id, user_id) VALUES (?, ?)",
        [taskId, userId]
      )

      return NextResponse.json({ ok: true, message: "Timer started" })
    } else {
      // Stop timer
      const [activeRows] = await db.execute<RowDataPacket[]>(
        "SELECT id, start_time FROM task_time_logs WHERE task_id = ? AND user_id = ? AND end_time IS NULL LIMIT 1",
        [taskId, userId]
      )

      if (activeRows.length === 0) {
        return badRequest("No active timer found")
      }

      const logId = activeRows[0].id
      
      // Update with duration
      await db.execute(
        `UPDATE task_time_logs 
         SET end_time = CURRENT_TIMESTAMP, 
             duration_seconds = TIMESTAMPDIFF(SECOND, start_time, CURRENT_TIMESTAMP)
         WHERE id = ?`,
        [logId]
      )

      return NextResponse.json({ ok: true, message: "Timer stopped" })
    }
  } catch (error) {
    console.error("Timer action failed:", error)
    return serverError("Could not update timer")
  }
}
