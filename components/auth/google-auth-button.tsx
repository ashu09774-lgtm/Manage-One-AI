"use client"

import { useEffect, useId, useState } from "react"
import { useRouter } from "next/navigation"

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (
            element: HTMLElement,
            options: Record<string, string>
          ) => void
        }
      }
    }
  }
}

export function GoogleAuthButton({ mode }: { mode: "login" | "signup" }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const router = useRouter()
  const elementId = useId().replace(/:/g, "")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!clientId) return

    const renderButton = () => {
      const target = document.getElementById(elementId)
      if (!target || !window.google) return

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          const response = await fetch("/api/auth/google", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ credential }),
          })
          const data = await response.json()

          if (!response.ok) {
            setError(data.error ?? "Google sign-in failed")
            return
          }

          localStorage.setItem("taskflow_user", JSON.stringify(data.user))
          router.push("/dashboard")
        },
      })

      target.innerHTML = ""
      window.google.accounts.id.renderButton(target, {
        theme: "outline",
        size: "large",
        text: mode === "login" ? "continue_with" : "signup_with",
        shape: "rectangular",
        width: "320",
      })
    }

    if (window.google) {
      renderButton()
      return
    }

    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = renderButton
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [clientId, elementId, mode, router])

  if (!clientId) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Google OAuth will activate after adding `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div id={elementId} className="flex justify-center" />
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
    </div>
  )
}
