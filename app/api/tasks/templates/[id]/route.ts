import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { badRequest, serverError, getUserId } from "@/lib/api-utils"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const templateId = Number(id)
    const userId = getUserId(request)

    if (!templateId || !userId) {
      return badRequest("Missing required parameters")
    }

    // Verify ownership
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM task_templates WHERE id = ? AND user_id = ? LIMIT 1",
      [templateId, userId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    await db.execute<ResultSetHeader>("DELETE FROM task_templates WHERE id = ?", [templateId])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete task template failed:", error)
    return serverError("Could not delete template")
  }
}
