import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { sendTeamInvitationEmail } from "@/lib/email"
import crypto from "crypto"

export async function POST(request: Request) {
  const userId = getUserId(request)

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const { email, teamId, role } = await request.json()

    if (!email || !teamId) {
      return badRequest("Missing required fields: email, teamId")
    }

    if (!["lead", "member"].includes(role)) {
      return badRequest("Invalid role")
    }

    // Check if user is a member of the team
    const [teamCheck] = await db.execute<RowDataPacket[]>(
      `SELECT t.id, t.name, w.id as workspace_id
       FROM teams t
       JOIN workspaces w ON w.id = t.workspace_id
       JOIN team_members tm ON tm.team_id = t.id
       WHERE t.id = ? AND tm.user_id = ? AND tm.role = 'lead'`,
      [teamId, userId]
    )

    if (!teamCheck || teamCheck.length === 0) {
      return badRequest("You don't have permission to invite members to this team")
    }

    const team = teamCheck[0]

    // Check if user is already in team
    const [existingMember] = await db.execute<RowDataPacket[]>(
      `SELECT user_id FROM team_members WHERE team_id = ? AND user_id = (SELECT id FROM users WHERE email = ?)`,
      [teamId, email]
    )

    if (existingMember && existingMember.length > 0) {
      return badRequest("User is already a member of this team")
    }

    // Check if invitation already exists
    const [existingInvite] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM team_invitations WHERE team_id = ? AND email = ? AND accepted_at IS NULL`,
      [teamId, email]
    )

    if (existingInvite && existingInvite.length > 0) {
      return badRequest("Invitation already sent to this email")
    }

    // Generate unique token
    const inviteToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create invitation
    await db.execute(
      `INSERT INTO team_invitations (team_id, email, token, role, invited_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [teamId, email, inviteToken, role, userId, expiresAt]
    )

    // Get inviter details
    const [inviterData] = await db.execute<RowDataPacket[]>(
      `SELECT name FROM users WHERE id = ?`,
      [userId]
    )

    const inviterName = inviterData?.[0]?.name || "A teammate"

    // Send invitation email
    await sendTeamInvitationEmail(email, inviterName, team.name, inviteToken)

    return NextResponse.json(
      { message: "Invitation sent successfully", email },
      { status: 201 }
    )
  } catch (error) {
    console.error("Invite team member failed:", error)
    return serverError("Could not send invitation")
  }
}
