import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { badRequest, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

const assignableRoles = ["admin", "member", "viewer"]

async function getActorRole(workspaceId: number, userId: number) {
  const [[membership]] = await db.execute<(RowDataPacket & { role: string })[]>(
    "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
    [workspaceId, userId]
  )

  return membership?.role ?? null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params
    const workspaceId = Number(id)
    const targetUserId = Number(memberId)
    const { userId, role } = await request.json()
    const actorId = Number(userId)
    const nextRole = assignableRoles.includes(role) ? role : null

    if (!Number.isInteger(workspaceId) || workspaceId < 1 || !Number.isInteger(targetUserId) || targetUserId < 1 || !Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Invalid request")
    }

    if (!nextRole) {
      return badRequest("Invalid role")
    }

    const actorRole = await getActorRole(workspaceId, actorId)
    if (!actorRole) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (!["owner", "admin"].includes(actorRole)) {
      return NextResponse.json({ error: "You do not have permission to update roles" }, { status: 403 })
    }

    const [[targetMembership]] = await db.execute<(RowDataPacket & { role: string })[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [workspaceId, targetUserId]
    )

    if (!targetMembership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    if (targetMembership.role === "owner") {
      return NextResponse.json({ error: "Owner role cannot be changed" }, { status: 400 })
    }

    await db.execute<ResultSetHeader>(
      "UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?",
      [nextRole, workspaceId, targetUserId]
    )

    return NextResponse.json({ ok: true, role: nextRole })
  } catch (error) {
    console.error("Update workspace member failed:", error)
    return serverError("Could not update member role")
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params
    const workspaceId = Number(id)
    const targetUserId = Number(memberId)
    const { searchParams } = new URL(request.url)
    const actorId = Number(searchParams.get("userId"))

    if (!Number.isInteger(workspaceId) || workspaceId < 1 || !Number.isInteger(targetUserId) || targetUserId < 1 || !Number.isInteger(actorId) || actorId < 1) {
      return badRequest("Invalid request")
    }

    const actorRole = await getActorRole(workspaceId, actorId)
    if (!actorRole) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (!["owner", "admin"].includes(actorRole)) {
      return NextResponse.json({ error: "You do not have permission to remove members" }, { status: 403 })
    }

    const [[targetMembership]] = await db.execute<(RowDataPacket & { role: string })[]>(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      [workspaceId, targetUserId]
    )

    if (!targetMembership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    if (targetMembership.role === "owner") {
      return NextResponse.json({ error: "Owner cannot be removed" }, { status: 400 })
    }

    await db.execute<ResultSetHeader>(
      "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      [workspaceId, targetUserId]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Remove workspace member failed:", error)
    return serverError("Could not remove member")
  }
}
