import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { notifyMentionedUsers } from "@/lib/mentions"
import { emitWorkspaceEvent } from "@/lib/realtime"

export async function GET(request: Request) {
  const userId = getUserId(request)
  const { searchParams } = new URL(request.url)
  const workspaceId = Number(searchParams.get("workspaceId"))

  if (!userId) {
    return badRequest("Missing user id")
  }

  if (!Number.isInteger(workspaceId) || workspaceId < 1) {
    return badRequest("Invalid workspace id")
  }

  try {
    const [[membership]] = await db.execute<RowDataPacket[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [workspaceId, userId]
    )

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const [messages] = await db.execute<RowDataPacket[]>(
      `SELECT
        wm.id,
        wm.body,
        wm.user_id AS userId,
        COALESCE(u.name, 'System') AS userName,
        DATE_FORMAT(wm.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM workspace_messages wm
      LEFT JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ?
      ORDER BY wm.created_at DESC, wm.id DESC
      LIMIT 50`,
      [workspaceId]
    )

    const [activity] = await db.execute<RowDataPacket[]>(
      `SELECT
        ae.id,
        COALESCE(u.name, 'System') AS actor,
        ae.action,
        COALESCE(
          JSON_UNQUOTE(JSON_EXTRACT(ae.metadata, '$.title')),
          JSON_UNQUOTE(JSON_EXTRACT(ae.metadata, '$.name')),
          JSON_UNQUOTE(JSON_EXTRACT(ae.metadata, '$.taskTitle')),
          ae.entity_type
        ) AS subject,
        DATE_FORMAT(ae.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM activity_events ae
      LEFT JOIN users u ON u.id = ae.actor_id
      WHERE ae.workspace_id = ?
      ORDER BY ae.created_at DESC
      LIMIT 25`,
      [workspaceId]
    )

    const [members] = await db.execute<RowDataPacket[]>(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.status,
        wm.role
      FROM workspace_members wm
      INNER JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ?
      ORDER BY FIELD(wm.role, 'owner', 'admin', 'member', 'viewer'), u.name`,
      [workspaceId]
    )

    const [[sharedDoc]] = await db.execute<RowDataPacket[]>(
      `SELECT
        content,
        updated_by AS updatedBy,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
      FROM workspace_shared_docs
      WHERE workspace_id = ?
      LIMIT 1`,
      [workspaceId]
    )

    return NextResponse.json({
      messages: messages.reverse().map((message) => ({
        id: Number(message.id),
        body: String(message.body),
        userId: message.userId === null ? null : Number(message.userId),
        userName: String(message.userName),
        createdAt: String(message.createdAt),
      })),
      activity: activity.map((item) => ({
        id: Number(item.id),
        actor: String(item.actor),
        action: String(item.action),
        subject: String(item.subject),
        createdAt: String(item.createdAt),
      })),
      members: members.map((member) => ({
        id: Number(member.id),
        name: String(member.name),
        email: String(member.email),
        status: String(member.status),
        role: String(member.role),
      })),
      sharedDoc: {
        content: sharedDoc?.content ? String(sharedDoc.content) : "",
        updatedBy: sharedDoc?.updatedBy === null || sharedDoc?.updatedBy === undefined ? null : Number(sharedDoc.updatedBy),
        updatedAt: sharedDoc?.updatedAt ? String(sharedDoc.updatedAt) : null,
      },
    })
  } catch (error) {
    console.error("Fetch collaboration state failed:", error)
    return serverError("Could not load collaboration data")
  }
}

export async function POST(request: Request) {
  try {
    const { userId, workspaceId, body } = await request.json()
    const actorId = Number(userId)
    const parsedWorkspaceId = Number(workspaceId)
    const messageBody = String(body ?? "").trim()

    if (!Number.isInteger(actorId) || actorId < 1 || !Number.isInteger(parsedWorkspaceId) || parsedWorkspaceId < 1) {
      return badRequest("Invalid request")
    }

    if (!messageBody) {
      return badRequest("Message is required")
    }

    const [[membership]] = await db.execute<RowDataPacket[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [parsedWorkspaceId, actorId]
    )

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const [[user]] = await db.execute<RowDataPacket[]>(
      "SELECT name FROM users WHERE id = ? LIMIT 1",
      [actorId]
    )

    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO workspace_messages (workspace_id, user_id, body) VALUES (?, ?, ?)",
      [parsedWorkspaceId, actorId, messageBody]
    )

    await db.execute(
      `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, 'messaged', 'workspace_message', ?, JSON_OBJECT('preview', ?))`,
      [parsedWorkspaceId, actorId, result.insertId, messageBody.slice(0, 120)]
    )

    await notifyMentionedUsers({
      workspaceId: parsedWorkspaceId,
      actorId,
      text: messageBody,
      title: "You were mentioned in workspace chat",
      body: `${user ? String(user.name) : "A teammate"} mentioned you in workspace chat.`,
      entityType: "workspace_message",
      entityId: result.insertId,
    })

    const payload = {
      id: result.insertId,
      body: messageBody,
      userId: actorId,
      userName: user ? String(user.name) : "You",
      createdAt: new Date().toISOString(),
    }

    emitWorkspaceEvent(parsedWorkspaceId, "workspace_message", payload)
    emitWorkspaceEvent(parsedWorkspaceId, "activity", {
      actor: user ? String(user.name) : "You",
      action: "messaged",
      subject: messageBody.slice(0, 80),
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({ message: payload })
  } catch (error) {
    console.error("Create collaboration message failed:", error)
    return serverError("Could not send message")
  }
}
