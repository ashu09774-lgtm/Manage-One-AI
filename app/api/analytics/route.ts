import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

export async function GET(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const workspaceId = Number(searchParams.get("workspaceId"))
  const range = String(searchParams.get("range") ?? "30")
  const rangeDays = ["7", "30", "90"].includes(range) ? Number(range) : 30

  if (!userId) {
    return badRequest("Missing user id")
  }

  const workspaceFilter = Number.isInteger(workspaceId) && workspaceId > 0 ? "AND t.workspace_id = ?" : ""
  const taskParams: Array<number | string> = [userId, rangeDays]
  if (workspaceFilter) taskParams.push(workspaceId)

  try {
    const [[metrics]] = await db.execute<RowDataPacket[]>(
      `SELECT
        COUNT(t.id) AS totalTasks,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completedTasks,
        COUNT(CASE WHEN t.status <> 'done' AND t.due_date < CURDATE() THEN 1 END) AS overdueTasks,
        COUNT(CASE WHEN t.status <> 'done' THEN 1 END) AS openTasks,
        COUNT(CASE WHEN t.status = 'in-progress' THEN 1 END) AS inProgressTasks,
        COALESCE(ROUND(COUNT(CASE WHEN t.status = 'done' THEN 1 END) / NULLIF(COUNT(t.id), 0) * 100), 0) AS completionRate,
        COALESCE(ROUND(AVG(CASE WHEN t.status = 'done' AND t.completed_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, t.created_at, t.completed_at) END)), 0) AS avgCompletionHours
      FROM tasks t
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.created_at >= CURDATE() - INTERVAL ? DAY ${workspaceFilter}`,
      taskParams
    )

    const [weeklyData] = await db.execute<RowDataPacket[]>(
      `SELECT
        DATE_FORMAT(days.day, '%a') AS day,
        COUNT(t.id) AS tasks,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed
      FROM (
        SELECT CURDATE() - INTERVAL 6 DAY AS day
        UNION ALL SELECT CURDATE() - INTERVAL 5 DAY
        UNION ALL SELECT CURDATE() - INTERVAL 4 DAY
        UNION ALL SELECT CURDATE() - INTERVAL 3 DAY
        UNION ALL SELECT CURDATE() - INTERVAL 2 DAY
        UNION ALL SELECT CURDATE() - INTERVAL 1 DAY
        UNION ALL SELECT CURDATE()
      ) days
      LEFT JOIN tasks t ON DATE(t.created_at) = days.day
      LEFT JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.id IS NULL OR wm.user_id = ?
      GROUP BY days.day
      ORDER BY days.day`,
      [userId, userId]
    )

    const completionParams: Array<number | string> = [rangeDays]
    if (workspaceFilter) completionParams.push(workspaceId)
    completionParams.push(userId, userId)
    const [completionGraph] = await db.execute<RowDataPacket[]>(
      `SELECT
        DATE_FORMAT(days.day, '%b %e') AS label,
        DATE_FORMAT(days.day, '%Y-%m-%d') AS date,
        COUNT(t.id) AS created,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed
      FROM (
        SELECT CURDATE() - INTERVAL seq.n DAY AS day
        FROM (
          SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
          UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
          UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
          UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
          UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24
          UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
          UNION ALL SELECT 30 UNION ALL SELECT 31 UNION ALL SELECT 32 UNION ALL SELECT 33 UNION ALL SELECT 34
          UNION ALL SELECT 35 UNION ALL SELECT 36 UNION ALL SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39
          UNION ALL SELECT 40 UNION ALL SELECT 41 UNION ALL SELECT 42 UNION ALL SELECT 43 UNION ALL SELECT 44
          UNION ALL SELECT 45 UNION ALL SELECT 46 UNION ALL SELECT 47 UNION ALL SELECT 48 UNION ALL SELECT 49
          UNION ALL SELECT 50 UNION ALL SELECT 51 UNION ALL SELECT 52 UNION ALL SELECT 53 UNION ALL SELECT 54
          UNION ALL SELECT 55 UNION ALL SELECT 56 UNION ALL SELECT 57 UNION ALL SELECT 58 UNION ALL SELECT 59
          UNION ALL SELECT 60 UNION ALL SELECT 61 UNION ALL SELECT 62 UNION ALL SELECT 63 UNION ALL SELECT 64
          UNION ALL SELECT 65 UNION ALL SELECT 66 UNION ALL SELECT 67 UNION ALL SELECT 68 UNION ALL SELECT 69
          UNION ALL SELECT 70 UNION ALL SELECT 71 UNION ALL SELECT 72 UNION ALL SELECT 73 UNION ALL SELECT 74
          UNION ALL SELECT 75 UNION ALL SELECT 76 UNION ALL SELECT 77 UNION ALL SELECT 78 UNION ALL SELECT 79
          UNION ALL SELECT 80 UNION ALL SELECT 81 UNION ALL SELECT 82 UNION ALL SELECT 83 UNION ALL SELECT 84
          UNION ALL SELECT 85 UNION ALL SELECT 86 UNION ALL SELECT 87 UNION ALL SELECT 88 UNION ALL SELECT 89
        ) seq
        WHERE seq.n < ?
      ) days
      LEFT JOIN tasks t ON DATE(t.created_at) = days.day ${workspaceFilter}
      LEFT JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.id IS NULL OR wm.user_id = ?
      GROUP BY days.day
      ORDER BY days.day`,
      completionParams
    )

    const [workspaceStats] = await db.execute<RowDataPacket[]>(
      `SELECT
        w.id,
        w.name,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed,
        COUNT(t.id) AS total,
        COUNT(CASE WHEN t.status <> 'done' AND t.due_date < CURDATE() THEN 1 END) AS overdue,
        COALESCE(ROUND(COUNT(CASE WHEN t.status = 'done' THEN 1 END) / NULLIF(COUNT(t.id), 0) * 100), 0) AS percentage
      FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
      LEFT JOIN tasks t ON t.workspace_id = w.id
      WHERE w.archived_at IS NULL ${Number.isInteger(workspaceId) && workspaceId > 0 ? "AND w.id = ?" : ""}
      GROUP BY w.id, w.name
      ORDER BY w.updated_at DESC
      LIMIT 6`,
      Number.isInteger(workspaceId) && workspaceId > 0 ? [userId, workspaceId] : [userId]
    )

    const [teamPerformance] = await db.execute<RowDataPacket[]>(
      `SELECT
        u.id,
        u.name,
        u.email,
        COUNT(t.id) AS assigned,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed,
        COUNT(CASE WHEN t.status <> 'done' AND t.due_date < CURDATE() THEN 1 END) AS overdue,
        COALESCE(ROUND(COUNT(CASE WHEN t.status = 'done' THEN 1 END) / NULLIF(COUNT(t.id), 0) * 100), 0) AS completionRate
      FROM users u
      INNER JOIN workspace_members wm ON wm.user_id = u.id
      INNER JOIN workspaces w ON w.id = wm.workspace_id AND w.archived_at IS NULL
      LEFT JOIN tasks t ON t.assignee_id = u.id AND t.workspace_id = w.id AND t.created_at >= CURDATE() - INTERVAL ? DAY
      WHERE EXISTS (
        SELECT 1 FROM workspace_members viewer
        WHERE viewer.workspace_id = wm.workspace_id AND viewer.user_id = ?
      )
      ${Number.isInteger(workspaceId) && workspaceId > 0 ? "AND wm.workspace_id = ?" : ""}
      GROUP BY u.id, u.name, u.email
      ORDER BY completed DESC, assigned DESC, u.name
      LIMIT 8`,
      Number.isInteger(workspaceId) && workspaceId > 0 ? [rangeDays, userId, workspaceId] : [rangeDays, userId]
    )

    const [priorityBreakdown] = await db.execute<RowDataPacket[]>(
      `SELECT
        t.priority,
        COUNT(t.id) AS total,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed
      FROM tasks t
      INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.created_at >= CURDATE() - INTERVAL ? DAY ${workspaceFilter}
      GROUP BY t.priority
      ORDER BY FIELD(t.priority, 'urgent', 'high', 'medium', 'low')`,
      taskParams
    )

    const normalizedMetrics = {
      totalTasks: Number(metrics.totalTasks ?? 0),
      completedTasks: Number(metrics.completedTasks ?? 0),
      overdueTasks: Number(metrics.overdueTasks ?? 0),
      openTasks: Number(metrics.openTasks ?? 0),
      inProgressTasks: Number(metrics.inProgressTasks ?? 0),
      completionRate: Number(metrics.completionRate ?? 0),
      avgCompletionHours: Number(metrics.avgCompletionHours ?? 0),
    }

    return NextResponse.json({
      filters: {
        workspaceId: Number.isInteger(workspaceId) && workspaceId > 0 ? workspaceId : null,
        rangeDays,
      },
      metrics: normalizedMetrics,
      weeklyData: weeklyData.map((item) => ({
        day: String(item.day),
        tasks: Number(item.tasks ?? 0),
        completed: Number(item.completed ?? 0),
      })),
      completionGraph: completionGraph.map((item) => ({
        label: String(item.label),
        date: String(item.date),
        created: Number(item.created ?? 0),
        completed: Number(item.completed ?? 0),
      })),
      workspaceStats: workspaceStats.map((item) => ({
        id: Number(item.id),
        name: String(item.name),
        completed: Number(item.completed ?? 0),
        total: Number(item.total ?? 0),
        overdue: Number(item.overdue ?? 0),
        percentage: Number(item.percentage ?? 0),
      })),
      teamPerformance: teamPerformance.map((item) => ({
        id: Number(item.id),
        name: String(item.name),
        email: String(item.email),
        assigned: Number(item.assigned ?? 0),
        completed: Number(item.completed ?? 0),
        overdue: Number(item.overdue ?? 0),
        completionRate: Number(item.completionRate ?? 0),
      })),
      priorityBreakdown: priorityBreakdown.map((item) => ({
        priority: String(item.priority),
        total: Number(item.total ?? 0),
        completed: Number(item.completed ?? 0),
      })),
      insights: buildInsights(normalizedMetrics, teamPerformance, workspaceStats),
      exportRows: buildExportRows(normalizedMetrics, workspaceStats, teamPerformance),
    })
  } catch (error) {
    console.error("Fetch analytics failed:", error)
    return serverError("Could not load analytics")
  }
}

function buildInsights(metrics: Record<string, number>, teamRows: RowDataPacket[], workspaceRows: RowDataPacket[]) {
  const insights = []
  if (metrics.totalTasks === 0) {
    insights.push({
      title: "No task signal yet",
      body: "Create tasks or widen the date range to generate productivity insights.",
      tone: "muted",
    })
    return insights
  }

  if (metrics.completionRate >= 70) {
    insights.push({
      title: "Strong completion momentum",
      body: `${metrics.completionRate}% of tracked tasks are complete in this range.`,
      tone: "positive",
    })
  } else {
    insights.push({
      title: "Completion rate needs attention",
      body: `Completion is at ${metrics.completionRate}%. Review blocked or oversized tasks first.`,
      tone: "warning",
    })
  }

  if (metrics.overdueTasks > 0) {
    insights.push({
      title: "Deadline risk detected",
      body: `${metrics.overdueTasks} open tasks are overdue. Prioritize reassignment or due-date triage.`,
      tone: "danger",
    })
  }

  const topMember = [...teamRows].sort((left, right) => Number(right.completed ?? 0) - Number(left.completed ?? 0))[0]
  if (topMember && Number(topMember.completed ?? 0) > 0) {
    insights.push({
      title: "Top contributor",
      body: `${String(topMember.name)} completed ${Number(topMember.completed)} tasks in this range.`,
      tone: "positive",
    })
  }

  const laggingWorkspace = [...workspaceRows].filter((row) => Number(row.total ?? 0) > 0).sort((left, right) => Number(left.percentage ?? 0) - Number(right.percentage ?? 0))[0]
  if (laggingWorkspace && Number(laggingWorkspace.percentage ?? 0) < 50) {
    insights.push({
      title: "Workspace follow-up",
      body: `${String(laggingWorkspace.name)} is ${Number(laggingWorkspace.percentage)}% complete and may need planning support.`,
      tone: "warning",
    })
  }

  return insights.slice(0, 4)
}

function buildExportRows(metrics: Record<string, number>, workspaceRows: RowDataPacket[], teamRows: RowDataPacket[]) {
  return [
    { section: "summary", name: "Total tasks", value: metrics.totalTasks },
    { section: "summary", name: "Completed tasks", value: metrics.completedTasks },
    { section: "summary", name: "Overdue tasks", value: metrics.overdueTasks },
    { section: "summary", name: "Completion rate", value: `${metrics.completionRate}%` },
    ...workspaceRows.map((row) => ({
      section: "workspace",
      name: String(row.name),
      value: `${Number(row.completed ?? 0)}/${Number(row.total ?? 0)} complete`,
    })),
    ...teamRows.map((row) => ({
      section: "team",
      name: String(row.name),
      value: `${Number(row.completed ?? 0)}/${Number(row.assigned ?? 0)} complete`,
    })),
  ]
}
