import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { z } from "zod"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/password"
import { rateLimiter } from "@/lib/rate-limit"
import { createSessionToken, sessionCookieName, sessionMaxAge } from "@/lib/session"

const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(120).transform((v) => v.trim()),
  email: z.string().email("Please enter a valid email address").max(190).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
})

type ExistingUser = RowDataPacket & {
  id: number
}

export async function POST(request: Request) {
  try {
    // Rate limit: 3 signups per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = rateLimiter.limit(`signup:${ip}`, { limit: 3, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again in a minute." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

    const body = await request.json()
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    const { name: trimmedName, email: normalizedEmail, password: plainPassword } = parsed.data

    const [existingUsers] = await db.execute<ExistingUser[]>("SELECT id FROM users WHERE email = ? LIMIT 1", [
      normalizedEmail,
    ])

    if (existingUsers.length > 0) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [trimmedName, normalizedEmail, hashPassword(plainPassword)]
    )

    await db.execute(
      `INSERT INTO user_settings (user_id)
      VALUES (?)
      ON DUPLICATE KEY UPDATE user_id = user_id`,
      [result.insertId]
    )

    const response = NextResponse.json({
      user: {
        id: String(result.insertId),
        name: trimmedName,
        email: normalizedEmail,
      },
    })
    response.cookies.set(
      sessionCookieName,
      await createSessionToken({ id: result.insertId, name: trimmedName, email: normalizedEmail }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: sessionMaxAge,
        path: "/",
      }
    )

    return response
  } catch (error) {
    console.error("Signup failed:", error)
    return NextResponse.json({ error: "Could not create account. Check that MySQL is running." }, { status: 500 })
  }
}
