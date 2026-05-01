import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { badRequest, serverError } from "@/lib/api-utils"
import type { RowDataPacket, ResultSetHeader } from "mysql2"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!userId) {
      return badRequest("Missing user id")
    }

    const [views] = await db.execute<RowDataPacket[]>(
      `SELECT id, name, filters, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM saved_views
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    )

    return NextResponse.json({
      views: views.map((view) => ({
        id: Number(view.id),
        name: String(view.name),
        filters: typeof view.filters === "string" ? JSON.parse(view.filters) : view.filters,
        createdAt: String(view.createdAt),
      })),
    })
  } catch (error) {
    console.error("Fetch saved views failed:", error)
    return serverError("Could not load saved views")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, name, filters } = await request.json()

    if (!userId || !name?.trim()) {
      return badRequest("Missing required fields")
    }

    if (!filters || typeof filters !== "object") {
      return badRequest("Invalid filters")
    }

    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO saved_views (user_id, name, filters) VALUES (?, ?, ?)",
      [userId, name.trim(), JSON.stringify(filters)]
    )

    return NextResponse.json({
      view: {
        id: result.insertId,
        name: name.trim(),
        filters,
      },
    })
  } catch (error) {
    console.error("Create saved view failed:", error)
    return serverError("Could not save view")
  }
}
