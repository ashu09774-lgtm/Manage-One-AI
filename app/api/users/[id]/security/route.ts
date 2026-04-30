import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { hashPassword, verifyPassword } from "@/lib/password"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)

  if (!Number.isInteger(userId) || userId < 1) {
    return badRequest("Invalid user id")
  }

  try {
    const { currentPassword, newPassword, twoFactorEnabled } = await request.json()

    if (typeof twoFactorEnabled === "boolean" && !newPassword) {
      await db.execute(
        `INSERT INTO user_settings (user_id, two_factor_enabled)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE two_factor_enabled = VALUES(two_factor_enabled)`,
        [userId, twoFactorEnabled]
      )

      return NextResponse.json({ ok: true, twoFactorEnabled })
    }

    const plainCurrentPassword = String(currentPassword ?? "")
    const plainNewPassword = String(newPassword ?? "")

    if (!plainCurrentPassword || !plainNewPassword) {
      return badRequest("Current and new password are required")
    }

    if (plainNewPassword.length < 6) {
      return badRequest("New password must be at least 6 characters")
    }

    const [[user]] = await db.execute<(RowDataPacket & { passwordHash: string })[]>(
      "SELECT password_hash AS passwordHash FROM users WHERE id = ? LIMIT 1",
      [userId]
    )

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!verifyPassword(plainCurrentPassword, String(user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
    }

    await db.execute(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [hashPassword(plainNewPassword), userId]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Update security settings failed:", error)
    return serverError("Could not update security settings")
  }
}
