import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { generateNotificationSweep } from "@/lib/notifications"

export async function GET(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const type = String(searchParams.get("type") ?? "all")
  const status = String(searchParams.get("status") ?? "all")
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100)

  if (!userId) {
    return badRequest("Missing user id")
  }

  const filters = ["user_id = ?"]
  const params: Array<number | string> = [userId]

  if (type !== "all") {
    filters.push("type = ?")
    params.push(type)
  }

  if (status === "unread") {
    filters.push("read_at IS NULL")
  } else if (status === "read") {
    filters.push("read_at IS NOT NULL")
  }

  params.push(limit)

  try {
    const [notifications] = await db.execute<RowDataPacket[]>(
      `SELECT
        id,
        type,
        title,
        body,
        entity_type AS entityType,
        entity_id AS entityId,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        read_at AS readAt
      FROM notifications
      WHERE ${filters.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ?`,
      params
    )

    const [[summary]] = await db.execute<RowDataPacket[]>(
      `SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN read_at IS NULL THEN 1 END) AS unread,
        COUNT(CASE WHEN type = 'deadline' AND read_at IS NULL THEN 1 END) AS deadlineUnread,
        COUNT(CASE WHEN type = 'assignment' AND read_at IS NULL THEN 1 END) AS assignmentUnread,
        COUNT(CASE WHEN type = 'automation' AND read_at IS NULL THEN 1 END) AS automationUnread
      FROM notifications
      WHERE user_id = ?`,
      [userId]
    )

    const [[preferences]] = await db.execute<RowDataPacket[]>(
      `SELECT
        COALESCE(email_notifications, TRUE) AS emailNotifications,
        COALESCE(push_notifications, TRUE) AS pushNotifications,
        COALESCE(task_reminders, TRUE) AS taskReminders,
        COALESCE(weekly_digest, FALSE) AS weeklyDigest
      FROM user_settings
      WHERE user_id = ?
      LIMIT 1`,
      [userId]
    )

    return NextResponse.json({
      notifications: notifications.map(formatNotification),
      unreadCount: Number(summary?.unread ?? 0),
      summary: {
        total: Number(summary?.total ?? 0),
        unread: Number(summary?.unread ?? 0),
        deadlineUnread: Number(summary?.deadlineUnread ?? 0),
        assignmentUnread: Number(summary?.assignmentUnread ?? 0),
        automationUnread: Number(summary?.automationUnread ?? 0),
      },
      preferences: {
        emailNotifications: preferences ? Boolean(preferences.emailNotifications) : true,
        pushNotifications: preferences ? Boolean(preferences.pushNotifications) : true,
        taskReminders: preferences ? Boolean(preferences.taskReminders) : true,
        weeklyDigest: preferences ? Boolean(preferences.weeklyDigest) : false,
      },
    })
  } catch (error) {
    console.error("Fetch notifications failed:", error)
    return serverError("Could not load notifications")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, action } = await request.json()
    const parsedUserId = Number(userId)

    if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
      return badRequest("Missing user id")
    }

    if (action !== "generate_reminders") {
      return badRequest("Unsupported notification action")
    }

    const notifications = await generateNotificationSweep(parsedUserId)

    return NextResponse.json({
      created: notifications.length,
      notifications,
    })
  } catch (error) {
    console.error("Generate notifications failed:", error)
    return serverError("Could not generate notifications")
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, notificationId, markAllRead, preferences } = await request.json()
    const parsedUserId = Number(userId)

    if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
      return badRequest("Missing user id")
    }

    if (preferences && typeof preferences === "object") {
      await db.execute(
        `INSERT INTO user_settings
          (user_id, email_notifications, push_notifications, task_reminders, weekly_digest)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          email_notifications = VALUES(email_notifications),
          push_notifications = VALUES(push_notifications),
          task_reminders = VALUES(task_reminders),
          weekly_digest = VALUES(weekly_digest)`,
        [
          parsedUserId,
          Boolean(preferences.emailNotifications),
          Boolean(preferences.pushNotifications),
          Boolean(preferences.taskReminders),
          Boolean(preferences.weeklyDigest),
        ]
      )
      return NextResponse.json({ ok: true })
    }

    if (markAllRead) {
      await db.execute<ResultSetHeader>(
        "UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = ?",
        [parsedUserId]
      )
      return NextResponse.json({ ok: true })
    }

    const parsedNotificationId = Number(notificationId)
    if (!Number.isInteger(parsedNotificationId) || parsedNotificationId < 1) {
      return badRequest("Missing notification id")
    }

    await db.execute<ResultSetHeader>(
      "UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?",
      [parsedNotificationId, parsedUserId]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Update notifications failed:", error)
    return serverError("Could not update notifications")
  }
}

export async function DELETE(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const notificationId = Number(searchParams.get("notificationId"))
  const clear = String(searchParams.get("clear") ?? "")

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    if (clear === "read") {
      await db.execute<ResultSetHeader>("DELETE FROM notifications WHERE user_id = ? AND read_at IS NOT NULL", [userId])
      return NextResponse.json({ ok: true })
    }

    if (clear === "all") {
      await db.execute<ResultSetHeader>("DELETE FROM notifications WHERE user_id = ?", [userId])
      return NextResponse.json({ ok: true })
    }

    if (!Number.isInteger(notificationId) || notificationId < 1) {
      return badRequest("Missing notification id")
    }

    await db.execute<ResultSetHeader>(
      "DELETE FROM notifications WHERE id = ? AND user_id = ?",
      [notificationId, userId]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Clear notifications failed:", error)
    return serverError("Could not clear notifications")
  }
}

function formatNotification(item: RowDataPacket) {
  return {
    id: Number(item.id),
    type: String(item.type),
    title: String(item.title),
    body: item.body ? String(item.body) : null,
    entityType: item.entityType ? String(item.entityType) : null,
    entityId: item.entityId ? Number(item.entityId) : null,
    createdAt: String(item.createdAt),
    readAt: item.readAt ? String(item.readAt) : null,
  }
}
