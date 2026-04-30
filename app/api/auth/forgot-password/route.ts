import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    const normalizedEmail = String(email ?? "").trim().toLowerCase()

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const [[user]] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    )

    if (!user) {
      return NextResponse.json({ ok: true })
    }

    const token = randomBytes(32).toString("hex")
    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))",
      [user.id, token]
    )

    return NextResponse.json({
      ok: true,
      resetToken: process.env.NODE_ENV !== "production" ? token : undefined,
      resetId: result.insertId,
    })
  } catch (error) {
    console.error("Forgot password failed:", error)
    return NextResponse.json({ error: "Could not create reset request" }, { status: 500 })
  }
}
