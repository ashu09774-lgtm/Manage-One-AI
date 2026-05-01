import { NextResponse } from "next/server"
import type { RowDataPacket, ResultSetHeader } from "mysql2"
import { db } from "@/lib/db"
import { sendNotificationDigestEmail } from "@/lib/email"

// Note: In production, this should be protected by a secret token
// to ensure it is only triggered by your cron job scheduler.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find users who have weekly_digest enabled
    const [users] = await db.execute<RowDataPacket[]>(
      `SELECT u.id, u.name, u.email
       FROM users u
       INNER JOIN user_settings us ON us.user_id = u.id
       WHERE us.weekly_digest = TRUE`
    )

    let emailsSent = 0

    for (const user of users) {
      // Find up to 10 unread notifications for the user from the past week
      const [notifications] = await db.execute<RowDataPacket[]>(
        `SELECT id, title, body, type
         FROM notifications
         WHERE user_id = ? AND read_at IS NULL AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY created_at DESC
         LIMIT 10`,
        [user.id]
      )

      if (notifications.length > 0) {
        await sendNotificationDigestEmail(
          String(user.email),
          String(user.name),
          notifications.map((n) => ({
            title: String(n.title),
            body: n.body ? String(n.body) : null,
            type: String(n.type),
          }))
        )

        // Mark these notifications as emailed (optional, or just leave unread)
        const ids = notifications.map((n) => Number(n.id))
        if (ids.length > 0) {
           await db.execute<ResultSetHeader>(
             `UPDATE notifications SET read_at = NOW() WHERE id IN (${ids.join(",")})`
           )
        }

        emailsSent++
      }
    }

    return NextResponse.json({ ok: true, sent: emailsSent })
  } catch (error) {
    console.error("Failed to send digest emails:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
