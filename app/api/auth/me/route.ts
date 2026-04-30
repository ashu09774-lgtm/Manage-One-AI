import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { sessionCookieName, verifySessionToken } from "@/lib/session"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(sessionCookieName)?.value
  const session = await verifySessionToken(token)

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [[user]] = await db.execute<RowDataPacket[]>(
    "SELECT id, name, email, avatar_url AS avatarUrl, status FROM users WHERE id = ? LIMIT 1",
    [session.userId]
  )

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({ user })
}
