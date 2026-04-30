import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/password"

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()
    const resetToken = String(token ?? "").trim()
    const nextPassword = String(password ?? "")

    if (!resetToken || nextPassword.length < 6) {
      return NextResponse.json({ error: "Valid token and password are required" }, { status: 400 })
    }

    const [[resetRecord]] = await db.execute<RowDataPacket[]>(
      `SELECT id, user_id AS userId
      FROM password_reset_tokens
      WHERE token = ? AND used_at IS NULL AND expires_at > NOW()
      LIMIT 1`,
      [resetToken]
    )

    if (!resetRecord) {
      return NextResponse.json({ error: "Reset token is invalid or expired" }, { status: 400 })
    }

    await db.execute<ResultSetHeader>(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [hashPassword(nextPassword), resetRecord.userId]
    )
    await db.execute<ResultSetHeader>(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?",
      [resetRecord.id]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Reset password failed:", error)
    return NextResponse.json({ error: "Could not reset password" }, { status: 500 })
  }
}
