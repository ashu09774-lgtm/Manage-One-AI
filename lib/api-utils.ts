import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sessionCookieName, verifySessionToken } from "@/lib/session"

export function getUserId(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = Number(searchParams.get("userId"))

  return Number.isInteger(userId) && userId > 0 ? userId : null
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(sessionCookieName)?.value
  return verifySessionToken(token)
}

export async function getAuthenticatedUserId(request: Request) {
  const session = await getSessionUser()
  if (session?.userId) {
    return session.userId
  }
  return getUserId(request)
}

export async function parseJsonBody<T extends Record<string, unknown>>(request: Request) {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

export function requireString(value: unknown, field: string, maxLength = 500) {
  const parsed = String(value ?? "").trim()

  if (!parsed) {
    throw new ApiValidationError(`${field} is required`)
  }

  if (parsed.length > maxLength) {
    throw new ApiValidationError(`${field} must be ${maxLength} characters or fewer`)
  }

  return parsed
}

export function optionalString(value: unknown, maxLength = 1000) {
  const parsed = String(value ?? "").trim()
  return parsed ? parsed.slice(0, maxLength) : null
}

export function requirePositiveInteger(value: unknown, field: string) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ApiValidationError(`${field} is invalid`)
  }

  return parsed
}

export class ApiValidationError extends Error {
  status = 400
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function serverError(message = "Something went wrong") {
  return NextResponse.json({ error: message }, { status: 500 })
}

export function handleApiError(error: unknown, fallback = "Something went wrong") {
  if (error instanceof ApiValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error(fallback, error)
  return serverError(fallback)
}
