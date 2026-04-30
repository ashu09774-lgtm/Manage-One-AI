import { NextResponse } from "next/server"
import { sessionCookieName } from "@/lib/session"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  })
  return response
}
