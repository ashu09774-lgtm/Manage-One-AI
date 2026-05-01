import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the NextResponse since we are outside the Next.js runtime
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      data,
      status: init?.status ?? 200,
      headers: new Headers(init?.headers),
    })),
  },
}))

// Mock rate limiter to always allow
vi.mock("@/lib/rate-limit", () => ({
  rateLimiter: {
    limit: vi.fn(() => ({ success: true })),
  },
}))

// We need to import the route dynamically after mocking its dependencies
import { POST } from "@/app/api/auth/signup/route"
import { db } from "@/lib/db"

vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(),
  },
}))

describe("Signup API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 400 for invalid email", async () => {
    const req = new Request("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({
        name: "Test User",
        email: "not-an-email",
        password: "password123",
      }),
    })

    const response = await POST(req) as unknown as { status: number; data: { error: string } }
    
    expect(response.status).toBe(400)
    expect(response.data.error).toContain("valid email")
  })

  it("should return 400 for short password", async () => {
    const req = new Request("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({
        name: "Test User",
        email: "test@example.com",
        password: "123",
      }),
    })

    const response = await POST(req) as unknown as { status: number; data: { error: string } }
    
    expect(response.status).toBe(400)
    expect(response.data.error).toContain("at least 6 characters")
  })

  it("should return 409 if user exists", async () => {
    // Mock db.execute to return an existing user
    vi.mocked(db.execute).mockResolvedValueOnce([[{ id: 1 }]] as any)

    const req = new Request("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      }),
    })

    const response = await POST(req) as unknown as { status: number; data: { error: string } }
    
    expect(response.status).toBe(409)
    expect(response.data.error).toContain("already exists")
  })
})
