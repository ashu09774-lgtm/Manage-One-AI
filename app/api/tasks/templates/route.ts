import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { badRequest, serverError, getUserId } from "@/lib/api-utils"
import type { RowDataPacket, ResultSetHeader } from "mysql2"

export async function GET(request: Request) {
  try {
    const userId = getUserId(request)
    if (!userId) return badRequest("Missing user id")

    const [templates] = await db.execute<RowDataPacket[]>(
      `SELECT id, name, template_data AS templateData, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM task_templates
       WHERE user_id = ?
       ORDER BY name ASC`,
      [userId]
    )

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: Number(t.id),
        name: String(t.name),
        templateData: typeof t.templateData === "string" ? JSON.parse(t.templateData) : t.templateData,
        createdAt: String(t.createdAt),
      })),
    })
  } catch (error) {
    console.error("Fetch task templates failed:", error)
    return serverError("Could not load task templates")
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request)
    if (!userId) return badRequest("Missing user id")

    const { name, templateData } = await request.json()

    if (!name?.trim() || !templateData) {
      return badRequest("Missing required fields")
    }

    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO task_templates (user_id, name, template_data) VALUES (?, ?, ?)",
      [userId, name.trim(), JSON.stringify(templateData)]
    )

    return NextResponse.json({
      template: {
        id: result.insertId,
        name: name.trim(),
        templateData,
      },
    })
  } catch (error) {
    console.error("Create task template failed:", error)
    return serverError("Could not save template")
  }
}
