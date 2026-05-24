"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Mail, Loader2, X } from "lucide-react"

interface PendingInvitation {
  id: number
  email: string
  role: string
  created_at: string
  expires_at: string
  invited_by_name: string | null
}

interface PendingInvitationsProps {
  teamId: number
  isLead?: boolean
}

export function PendingInvitations({ teamId, isLead = false }: PendingInvitationsProps) {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const { toast } = useToast()

  const fetchInvitations = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/team/pending-invites?teamId=${teamId}`)
      const data = await response.json()

      if (response.ok) {
        setInvitations(data.invitations || [])
      } else {
        // Silently fail if user doesn't have permission
        setInvitations([])
      }
    } catch (error) {
      console.error("Failed to fetch invitations:", error)
      setInvitations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLead) {
      fetchInvitations()
    }
  }, [teamId, isLead])

  const handleCancelInvitation = async (invitationId: number) => {
    setCancelling(invitationId)
    try {
      const response = await fetch(`/api/team/pending-invites?id=${invitationId}&teamId=${teamId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setInvitations(invitations.filter((inv) => inv.id !== invitationId))
        toast({ title: "Success", description: "Invitation cancelled" })
      } else {
        toast({ title: "Error", description: "Failed to cancel invitation" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel invitation" })
    } finally {
      setCancelling(null)
    }
  }

  if (!isLead) return null

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>No pending invitations for this team</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
        <CardDescription>{invitations.length} invitation(s) awaiting response</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 flex-1">
                <Mail className="h-4 w-4 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{invitation.email}</p>
                  <p className="text-xs text-gray-500">
                    Invited {new Date(invitation.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="capitalize">
                    {invitation.role}
                  </Badge>
                  {new Date(invitation.expires_at) < new Date() ? (
                    <Badge variant="destructive" className="text-xs">
                      Expired
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Expires{" "}
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCancelInvitation(invitation.id)}
                disabled={cancelling === invitation.id}
              >
                {cancelling === invitation.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
