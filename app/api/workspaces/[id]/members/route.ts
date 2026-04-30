import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

type MemberRow = RowDataPacket & {
  id: number
  name: string
  email: string
  role: "owner" | "admin" | "member" | "viewer"
  status: "online" | "away" | "offline"
  tasks: number
}

type InvitationRow = RowDataPacket & {
  id: number
  email: string
  role: "admin" | "member" | "viewer"
  invitedByName: string | null
  createdAt: string
}

const assignableRoles = ["admin", "member", "viewer"]

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(request)
  const { id } = await params
  const workspaceId = Number(id)

  if (!userId) {
    return badRequest("Missing user id")
  }

  if (!Number.isInteger(workspaceId) || workspaceId < 1) {
    return badRequest("Invalid workspace id")
  }

  try {
    const [[membership]] = await db.execute<(RowDataPacket & { role: string })[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [workspaceId, userId]
    )

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const [members] = await db.execute<MemberRow[]>(
      `SELECT
        u.id,
        u.name,
        u.email,
        wm.role,
        u.status,
        COUNT(DISTINCT CASE WHEN t.status <> 'done' THEN t.id END) AS tasks
      FROM workspace_members wm
      INNER JOIN users u ON u.id = wm.user_id
      LEFT JOIN tasks t ON t.workspace_id = wm.workspace_id AND t.assignee_id = u.id
      WHERE wm.workspace_id = ?
      GROUP BY u.id, u.name, u.email, wm.role, u.status
      ORDER BY FIELD(wm.role, 'owner', 'admin', 'member', 'viewer'), u.name`,
      [workspaceId]
    )

    const [invitations] = await db.execute<InvitationRow[]>(
      `SELECT
        i.id,
        i.email,
        i.role,
        inviter.name AS invitedByName,
        DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM invitations i
      LEFT JOIN users inviter ON inviter.id = i.invited_by
      WHERE i.workspace_id = ? AND i.accepted_at IS NULL
      ORDER BY i.created_at DESC`,
      [workspaceId]
    )

    return NextResponse.json({
      role: membership.role,
      members: members.map((member) => ({
        id: Number(member.id),
        name: String(member.name),
        email: String(member.email),
        role: member.role,
        status: member.status,
        tasks: Number(member.tasks ?? 0),
      })),
      invitations: invitations.map((invitation) => ({
        id: Number(invitation.id),
        email: String(invitation.email),
        role: invitation.role,
        invitedByName: invitation.invitedByName ? String(invitation.invitedByName) : null,
        createdAt: String(invitation.createdAt),
      })),
    })
  } catch (error) {
    console.error("Fetch workspace members failed:", error)
    return serverError("Could not load workspace members")
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = Number(id)

  if (!Number.isInteger(workspaceId) || workspaceId < 1) {
    return badRequest("Invalid workspace id")
  }

  try {
    const { userId, email, role } = await request.json()
    const actorId = Number(userId)
    const invitedEmail = String(email ?? "").trim().toLowerCase()
    const invitedRole = assignableRoles.includes(role) ? role : "member"

    if (!Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Missing user id")
    }

    if (!invitedEmail) {
      return badRequest("Email is required")
    }

    const [[membership]] = await db.execute<(RowDataPacket & { role: string })[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [workspaceId, actorId]
    )

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (!["owner", "admin"].includes(String(membership.role))) {
      return NextResponse.json({ error: "You do not have permission to invite members" }, { status: 403 })
    }

    const [[existingUser]] = await db.execute<(RowDataPacket & { id: number; name: string; email: string })[]>(
      "SELECT id, name, email FROM users WHERE email = ? LIMIT 1",
      [invitedEmail]
    )

    if (existingUser) {
      await db.execute(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE role = VALUES(role)`,
        [workspaceId, Number(existingUser.id), invitedRole]
      )

      await db.execute(
        `INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
        VALUES (?, ?, 'shared', 'workspace_member', ?, JSON_OBJECT('email', ?, 'role', ?))`,
        [workspaceId, actorId, Number(existingUser.id), invitedEmail, invitedRole]
      )

      return NextResponse.json({
        member: {
          id: Number(existingUser.id),
          name: String(existingUser.name),
          email: String(existingUser.email),
          role: invitedRole,
          status: "offline",
          tasks: 0,
        },
      })
    }

    const token = randomUUID()
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO invitations (workspace_id, email, role, token, invited_by, expires_at)
      VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [workspaceId, invitedEmail, invitedRole, token, actorId]
    )

    return NextResponse.json({
      invitation: {
        id: result.insertId,
        email: invitedEmail,
        role: invitedRole,
        invitedByName: null,
        createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      },
    })
  } catch (error) {
    console.error("Invite workspace member failed:", error)
    return serverError("Could not invite member")
  }
}
