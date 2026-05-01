import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { z } from "zod"
import { db } from "@/lib/db"
import { verifyPassword } from "@/lib/password"
import { rateLimiter } from "@/lib/rate-limit"
import { createSessionToken, sessionCookieName, sessionMaxAge } from "@/lib/session"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Password is required"),
})

type UserRow = RowDataPacket & {
  id: number
  name: string
  email: string
  password_hash: string
}

export async function POST(request: Request) {
  try {
    // Rate limit: 5 login attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = rateLimiter.limit(`login:${ip}`, { limit: 5, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in a minute." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

    const body = await request.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    const { email: normalizedEmail, password: plainPassword } = parsed.data

    const [users] = await db.execute<UserRow[]>(
      "SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    )

    const user = users[0]

    if (!user || !verifyPassword(plainPassword, user.password_hash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const response = NextResponse.json({
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
      },
    })
    response.cookies.set(sessionCookieName, await createSessionToken(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionMaxAge,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Login failed:", error)
    return NextResponse.json({ error: "Could not sign in. Check that MySQL is running." }, { status: 500 })
  }
}
