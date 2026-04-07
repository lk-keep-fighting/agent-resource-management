'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SSOUser {
  id: string
  feishuUnionId: string | null
  email: string | null
  name: string | null
  avatarUrl: string | null
  role: 'ADMIN' | 'USER'
  createdAt: string | null
}

export interface UseSSOOptions {
  ssoUrl: string
  autoFetch?: boolean
}

export function createSSOClient(options: UseSSOOptions) {
  const { ssoUrl } = options

  async function getSession(): Promise<SSOUser | null> {
    try {
      const response = await fetch(`${ssoUrl}/api/auth/session`, {
        credentials: 'include',
      })
      const data = await response.json()
      return data.user
    } catch {
      return null
    }
  }

  async function getUserInfo(token: string): Promise<{ valid: boolean; user: SSOUser | null }> {
    try {
      const response = await fetch(`${ssoUrl}/api/auth/userinfo`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      return response.json()
    } catch {
      return { valid: false, user: null }
    }
  }

  function getFeishuAuthUrl(redirectUri?: string): string {
    const params = new URLSearchParams({
      redirect_uri: redirectUri || `${ssoUrl}/dashboard`,
    })
    return `${ssoUrl}/api/auth/feishu?${params.toString()}`
  }

  async function logout(): Promise<void> {
    await fetch(`${ssoUrl}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  }

  return {
    getSession,
    getUserInfo,
    getFeishuAuthUrl,
    logout,
  }
}

export function useSSO(ssoUrl: string, autoFetch = true) {
  const [user, setUser] = useState<SSOUser | null>(null)
  const [loading, setLoading] = useState(true)

  const client = createSSOClient({ ssoUrl })

  const fetchUser = useCallback(async () => {
    setLoading(true)
    const userData = await client.getSession()
    setUser(userData)
    setLoading(false)
  }, [ssoUrl])

  useEffect(() => {
    if (autoFetch) {
      fetchUser()
    }
  }, [autoFetch, fetchUser])

  const loginWithFeishu = useCallback((redirectUri?: string) => {
    const url = client.getFeishuAuthUrl(redirectUri)
    window.location.href = url
  }, [client])

  const logout = useCallback(async () => {
    await client.logout()
    setUser(null)
  }, [client])

  const refresh = useCallback(() => {
    fetchUser()
  }, [fetchUser])

  return {
    user,
    loading,
    loginWithFeishu,
    logout,
    refresh,
    isAuthenticated: !!user,
  }
}
