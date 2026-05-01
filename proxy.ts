import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { sessionCookieName, verifySessionToken } from "@/lib/session"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method.toUpperCase()

  // CSRF Protection
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin")
    const host = request.headers.get("host")

    if (!origin) {
      const referer = request.headers.get("referer")
      if (referer) {
        try {
          const refererUrl = new URL(referer)
          if (refererUrl.host !== host) {
            return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 })
          }
        } catch {}
      }
    } else {
      try {
        const originUrl = new URL(origin)
        if (originUrl.host !== host) {
          return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 })
        }
      } catch {
        return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 })
      }
    }
  }

  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }

  const token = request.cookies.get(sessionCookieName)?.value
  const session = await verifySessionToken(token)

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
}
