import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { z } from "zod"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/password"
import { rateLimiter } from "@/lib/rate-limit"

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required").transform((v) => v.trim()),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
})

export async function POST(request: Request) {
  try {
    // Rate limit: 5 reset attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = rateLimiter.limit(`reset-password:${ip}`, { limit: 5, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

    const body = await request.json()
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    const { token: resetToken, password: nextPassword } = parsed.data

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
