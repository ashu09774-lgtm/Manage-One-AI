import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/password"
import { createSessionToken, sessionCookieName, sessionMaxAge } from "@/lib/session"

type ExistingUser = RowDataPacket & {
  id: number
}

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()
    const trimmedName = String(name ?? "").trim()
    const normalizedEmail = String(email ?? "").trim().toLowerCase()
    const plainPassword = String(password ?? "")

    if (!trimmedName || !normalizedEmail || !plainPassword) {
      return NextResponse.json({ error: "Please fill in all fields" }, { status: 400 })
    }

    if (!normalizedEmail.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
    }

    if (plainPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

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
