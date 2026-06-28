'use client'
// components/AuthProvider.tsx — context user + permissions (PRD Section 13.1: cache permissions)

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { gasApi, GasError } from '@/lib/gasApi'
import { hasCredential, signOut as gisSignOut } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { AuthUser } from '@/lib/types'

interface AuthState {
  user: AuthUser | null
  permissions: Set<string>
  ready: boolean        // đã xác định xong trạng thái đăng nhập
  error: GasError | null
  hasPerm: (key: string) => boolean
  isManager: boolean
  refresh: () => void
  logout: () => void
}

const AuthCtx = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

const CACHE_KEY = 'auth.verify'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<GasError | null>(null)

  const verify = useCallback(() => {
    if (!hasCredential()) { setUser(null); setPermissions(new Set()); setReady(true); return }

    // dùng cache phiên để tránh verify lại mỗi điều hướng
    const cached = cache.get<{ user: AuthUser; permissions: string[] }>(CACHE_KEY)
    if (cached) {
      setUser(cached.user)
      setPermissions(new Set(cached.permissions))
      setReady(true)
    }

    gasApi<{ user: AuthUser; permissions: string[] }>('auth.verify')
      .then((data) => {
        setUser(data.user)
        setPermissions(new Set(data.permissions))
        setError(null)
        cache.set(CACHE_KEY, data, 30 * 60 * 1000)
      })
      .catch((e: GasError) => {
        setError(e)
        if (e.appStatus === 401 || e.needLogin) {
          setUser(null); setPermissions(new Set()); cache.del(CACHE_KEY)
        }
      })
      .finally(() => setReady(true))
  }, [])

  useEffect(() => { verify() }, [verify])

  const logout = useCallback(() => {
    gisSignOut()
    cache.del(CACHE_KEY)
    setUser(null); setPermissions(new Set())
    if (typeof window !== 'undefined') window.location.href = '/login'
  }, [])

  const hasPerm = useCallback((key: string) => permissions.has(key), [permissions])

  return (
    <AuthCtx.Provider
      value={{
        user, permissions, ready, error, hasPerm,
        isManager: user?.role_id === 'manager',
        refresh: verify, logout,
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}
