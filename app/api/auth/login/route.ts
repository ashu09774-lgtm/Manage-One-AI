import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { verifyPassword } from "@/lib/password"
import { createSessionToken, sessionCookieName, sessionMaxAge } from "@/lib/session"

type UserRow = RowDataPacket & {
  id: number
  name: string
  email: string
  password_hash: string
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    const normalizedEmail = String(email ?? "").trim().toLowerCase()
    const plainPassword = String(password ?? "")

    if (!normalizedEmail || !plainPassword) {
      return NextResponse.json({ error: "Please fill in all fields" }, { status: 400 })
    }

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
