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

    // Find invitation
    const [invitation] = await db.execute<RowDataPacket[]>(
      `SELECT id, email, accepted_at FROM team_invitations WHERE token = ?`,
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

    // Check if email matches
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return badRequest("This invitation was sent to a different email address")
    }

    // Delete invitation (reject it)
    await db.execute(
      `DELETE FROM team_invitations WHERE id = ?`,
      [invite.id]
    )

    return NextResponse.json(
      { message: "Invitation rejected successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Reject invitation failed:", error)
    return serverError("Could not reject invitation")
  }
}
