import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)

  if (!Number.isInteger(userId) || userId < 1) {
    return badRequest("Invalid user id")
  }

  try {
    const [[user]] = await db.execute<RowDataPacket[]>(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.avatar_url AS avatarUrl,
        COALESCE(s.theme, 'dark') AS theme,
        COALESCE(s.email_notifications, TRUE) AS emailNotifications,
        COALESCE(s.push_notifications, TRUE) AS pushNotifications,
        COALESCE(s.task_reminders, TRUE) AS taskReminders,
        COALESCE(s.weekly_digest, FALSE) AS weeklyDigest,
        COALESCE(s.two_factor_enabled, FALSE) AS twoFactorEnabled
      FROM users u
      LEFT JOIN user_settings s ON s.user_id = u.id
      WHERE u.id = ?
      LIMIT 1`,
      [userId]
    )

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Fetch user failed:", error)
    return serverError("Could not load user")
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)

  if (!Number.isInteger(userId) || userId < 1) {
    return badRequest("Invalid user id")
  }

  try {
    const body = await request.json()
    const name = String(body.name ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const theme = ["light", "dark", "system"].includes(body.theme) ? body.theme : "dark"

    if (!name || !email) {
      return badRequest("Name and email are required")
    }

    await db.execute("UPDATE users SET name = ?, email = ? WHERE id = ?", [name, email, userId])
    await db.execute(
      `INSERT INTO user_settings
        (user_id, theme, email_notifications, push_notifications, task_reminders, weekly_digest)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        theme = VALUES(theme),
        email_notifications = VALUES(email_notifications),
        push_notifications = VALUES(push_notifications),
        task_reminders = VALUES(task_reminders),
        weekly_digest = VALUES(weekly_digest)`,
      [
        userId,
        theme,
        Boolean(body.emailNotifications),
        Boolean(body.pushNotifications),
        Boolean(body.taskReminders),
        Boolean(body.weeklyDigest),
      ]
    )

    return NextResponse.json({
      user: {
        id: String(userId),
        name,
        email,
      },
    })
  } catch (error) {
    console.error("Update user failed:", error)
    return serverError("Could not save settings")
  }
}
