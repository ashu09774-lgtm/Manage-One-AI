import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { badRequest, getUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

export async function GET(request: Request) {
  const userId = getUserId(request)

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")

    if (!teamId) {
      return badRequest("Missing teamId parameter")
    }

    // Check if user is a lead member of the team
    const [teamCheck] = await db.execute<RowDataPacket[]>(
      `SELECT tm.user_id FROM team_members tm 
       WHERE tm.team_id = ? AND tm.user_id = ? AND tm.role = 'lead'`,
      [teamId, userId]
    )

    if (!teamCheck || teamCheck.length === 0) {
      return badRequest("You don't have permission to view invitations")
    }

    // Get pending invitations
    const [invitations] = await db.execute<RowDataPacket[]>(
      `SELECT 
        ti.id,
        ti.email,
        ti.role,
        ti.created_at,
        ti.expires_at,
        u.name as invited_by_name
       FROM team_invitations ti
       LEFT JOIN users u ON u.id = ti.invited_by
       WHERE ti.team_id = ? AND ti.accepted_at IS NULL AND ti.expires_at > NOW()
       ORDER BY ti.created_at DESC`,
      [teamId]
    )

    return NextResponse.json({ invitations })
  } catch (error) {
    console.error("Fetch pending invitations failed:", error)
    return serverError("Could not load invitations")
  }
}

export async function DELETE(request: Request) {
  const userId = getUserId(request)

  if (!userId) {
    return badRequest("Missing user id")
  }

  try {
    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get("id")
    const teamId = searchParams.get("teamId")

    if (!invitationId || !teamId) {
      return badRequest("Missing required parameters")
    }

    // Check if user is a lead member of the team
    const [teamCheck] = await db.execute<RowDataPacket[]>(
      `SELECT tm.user_id FROM team_members tm 
       WHERE tm.team_id = ? AND tm.user_id = ? AND tm.role = 'lead'`,
      [teamId, userId]
    )

    if (!teamCheck || teamCheck.length === 0) {
      return badRequest("You don't have permission to manage invitations")
    }

    // Delete invitation
    await db.execute(
      `DELETE FROM team_invitations WHERE id = ? AND team_id = ?`,
      [invitationId, teamId]
    )

    return NextResponse.json({ message: "Invitation cancelled successfully" })
  } catch (error) {
    console.error("Cancel invitation failed:", error)
    return serverError("Could not cancel invitation")
  }
}
