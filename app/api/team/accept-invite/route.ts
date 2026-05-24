import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  const userId = getUserId(request)

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const { token } = await request.json()

    if (!token) {
      return badRequest("Missing invite token")
    }

    // Get user email
    const [userData] = await db.execute<RowDataPacket[]>(
      `SELECT email FROM users WHERE id = ?`,
      [userId]
    )

    if (!userData || userData.length === 0) {
      return badRequest("User not found")
    }

    const userEmail = userData[0].email

    // Find and validate invitation
    const [invitation] = await db.execute<RowDataPacket[]>(
      `SELECT id, team_id, email, role, expires_at, accepted_at 
       FROM team_invitations 
       WHERE token = ?`,
      [token]
    )

    if (!invitation || invitation.length === 0) {
      return badRequest("Invalid invitation token")
    }

    const invite = invitation[0]

    // Check if already accepted
    if (invite.accepted_at) {
      return badRequest("This invitation has already been accepted")
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return badRequest("This invitation has expired")
    }

    // Check if email matches
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return badRequest("This invitation was sent to a different email address")
    }

    // Check if user is already a member
    const [existingMember] = await db.execute<RowDataPacket[]>(
      `SELECT user_id FROM team_members WHERE team_id = ? AND user_id = ?`,
      [invite.team_id, userId]
    )

    if (existingMember && existingMember.length > 0) {
      return badRequest("You are already a member of this team")
    }

    // Start transaction-like operations
    // Add user to team
    await db.execute(
      `INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)`,
      [invite.team_id, userId, invite.role]
    )

    // Mark invitation as accepted
    await db.execute(
      `UPDATE team_invitations SET accepted_by = ?, accepted_at = NOW() WHERE id = ?`,
      [userId, invite.id]
    )

    // Get team details
    const [teamData] = await db.execute<RowDataPacket[]>(
      `SELECT name FROM teams WHERE id = ?`,
      [invite.team_id]
    )

    const teamName = teamData?.[0]?.name || "Team"

    return NextResponse.json(
      {
        message: "Invitation accepted successfully",
        teamId: invite.team_id,
        teamName,
        role: invite.role,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Accept invitation failed:", error)
    return serverError("Could not accept invitation")
  }
}
