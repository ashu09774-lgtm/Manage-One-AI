import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"

export function extractMentions(text: string) {
  const matches = text.match(/@([a-zA-Z0-9._-]+)/g) ?? []
  return [...new Set(matches.map((item) => item.slice(1).toLowerCase()))]
}

export async function notifyMentionedUsers(input: {
  workspaceId: number
  actorId: number
  text: string
  title: string
  body: string
  entityType: string
  entityId: number
}) {
  const mentions = extractMentions(input.text)
  if (mentions.length === 0) return []

  const placeholders = mentions.map(() => "?").join(",")
  const [rows] = await db.execute<(RowDataPacket & { id: number; name: string })[]>(
    `SELECT u.id, u.name
    FROM users u
    INNER JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = ?
    WHERE LOWER(REPLACE(u.name, ' ', '')) IN (${placeholders})
      AND u.id <> ?`,
    [input.workspaceId, ...mentions.map((item) => item.replace(/\s+/g, "")), input.actorId]
  )

  for (const user of rows) {
    await createNotification({
      userId: Number(user.id),
      type: "mention",
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    })
  }

  return rows.map((row) => Number(row.id))
}
