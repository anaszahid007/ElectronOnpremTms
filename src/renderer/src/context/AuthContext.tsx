import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@shared/types'
import { api } from '@/lib/api'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth
      .session()
      .then(setUser)
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string): Promise<string | null> => {
    const result = await api.auth.login(username, password)
    if (result.ok) {
      setUser(await api.auth.session())
      return null
    }
    return result.error ?? 'Login failed'
  }

  const logout = async () => {
    await api.auth.logout()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
