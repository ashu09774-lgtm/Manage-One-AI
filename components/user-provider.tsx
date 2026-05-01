"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

interface UserData {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
  status?: string
}

interface UserContextValue {
  user: UserData | null
  isLoading: boolean
  refresh: () => Promise<void>
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  refresh: async () => {},
})

export function useUser() {
  return useContext(UserContext)
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchUser() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" })
      if (!response.ok) {
        setUser(null)
        return
      }
      const data = await response.json()
      const userData: UserData = {
        id: String(data.user.id),
        name: String(data.user.name),
        email: String(data.user.email),
        avatarUrl: data.user.avatarUrl ?? null,
        status: data.user.status ?? "online",
      }
      setUser(userData)
      // Keep localStorage in sync for backward compatibility during migration
      localStorage.setItem("manageone_user", JSON.stringify(userData))
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchUser()
  }, [])

  return (
    <UserContext.Provider value={{ user, isLoading, refresh: fetchUser }}>
      {children}
    </UserContext.Provider>
  )
}

