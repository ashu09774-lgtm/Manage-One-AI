import { OAuth2Client } from "google-auth-library"
import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { createSessionToken, sessionCookieName, sessionMaxAge } from "@/lib/session"

type UserRow = RowDataPacket & {
  id: number
  name: string
  email: string
}

export async function POST(request: Request) {
  try {
    const { credential } = await request.json()
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

    if (!clientId) {
      return NextResponse.json({ error: "Google OAuth is not configured" }, { status: 400 })
    }

    const client = new OAuth2Client(clientId)
    const ticket = await client.verifyIdToken({
      idToken: String(credential ?? ""),
      audience: clientId,
    })
    const payload = ticket.getPayload()

    if (!payload?.email || !payload.name) {
      return NextResponse.json({ error: "Google account information is incomplete" }, { status: 400 })
    }

    const email = payload.email.toLowerCase()
    const name = payload.name
    const avatarUrl = payload.picture ?? null

    const [[existingUser]] = await db.execute<UserRow[]>(
      "SELECT id, name, email FROM users WHERE email = ? LIMIT 1",
      [email]
    )

    let user: { id: number; name: string; email: string } | undefined = existingUser

    if (!user) {
      const [result] = await db.execute<ResultSetHeader>(
        "INSERT INTO users (name, email, avatar_url, password_hash) VALUES (?, ?, ?, ?)",
        [name, email, avatarUrl, "google-oauth"]
      )
      await db.execute(
        `INSERT INTO user_settings (user_id)
        VALUES (?)
        ON DUPLICATE KEY UPDATE user_id = user_id`,
        [result.insertId]
      )
      user = { id: result.insertId, name, email }
    } else if (avatarUrl) {
      await db.execute("UPDATE users SET avatar_url = ? WHERE id = ?", [avatarUrl, user.id])
    }

    const response = NextResponse.json({
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
      },
    })
    response.cookies.set(
      sessionCookieName,
      await createSessionToken({ id: Number(user.id), name: user.name, email: user.email }),
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
    console.error("Google auth failed:", error)
    return NextResponse.json({ error: "Google sign-in failed" }, { status: 500 })
  }
}
