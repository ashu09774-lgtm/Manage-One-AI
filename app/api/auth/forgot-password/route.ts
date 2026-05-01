import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { z } from "zod"
import { db } from "@/lib/db"
import { rateLimiter } from "@/lib/rate-limit"
import { sendPasswordResetEmail } from "@/lib/email"

const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required").transform((v) => v.trim().toLowerCase()),
})

export async function POST(request: Request) {
  try {
    // Rate limit: 3 reset requests per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = rateLimiter.limit(`forgot-password:${ip}`, { limit: 3, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

    const body = await request.json()
    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    const normalizedEmail = parsed.data.email

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

    await sendPasswordResetEmail(normalizedEmail, token)

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
