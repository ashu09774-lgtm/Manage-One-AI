import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { badRequest, serverError } from "@/lib/api-utils"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const viewId = Number(id)
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))

    if (!viewId || !userId) {
      return badRequest("Missing required parameters")
    }

    // Verify ownership
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM saved_views WHERE id = ? AND user_id = ? LIMIT 1",
      [viewId, userId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: "View not found" }, { status: 404 })
    }

    await db.execute<ResultSetHeader>("DELETE FROM saved_views WHERE id = ?", [viewId])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete saved view failed:", error)
    return serverError("Could not delete view")
  }
}
