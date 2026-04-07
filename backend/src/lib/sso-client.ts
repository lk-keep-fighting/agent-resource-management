import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'

export interface SSOUser {
  id: string
  feishuUnionId: string | null
  email: string | null
  name: string | null
  avatarUrl: string | null
  role: 'ADMIN' | 'USER'
  createdAt: Date | null
}

export interface SSOUserWithSsoId extends SSOUser {
  ssoUserId: string
}

export interface SSOConfig {
  ssoUrl: string
  jwtSecret: string
}

export interface TokenPayload {
  userId: string
  feishuUnionId: string
  role: string
}

function getConfig(): SSOConfig {
  const ssoUrl = process.env.SSO_URL
  const jwtSecret = process.env.SSO_JWT_SECRET

  if (!ssoUrl || !jwtSecret) {
    throw new Error('Missing SSO configuration. Please set SSO_URL and SSO_JWT_SECRET environment variables.')
  }

  return { ssoUrl, jwtSecret }
}

export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const cookies = request.cookies.get('auth_token')
  if (cookies?.value) {
    return cookies.value
  }
  const url = new URL(request.url)
  return url.searchParams.get('sso_token')
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const { jwtSecret } = getConfig()
    return jwt.verify(token, jwtSecret) as TokenPayload
  } catch {
    return null
  }
}

export function verifyTokenSync(token: string, secret: string): TokenPayload | null {
  try {
    return jwt.verify(token, secret) as TokenPayload
  } catch {
    return null
  }
}

export async function getUserInfo(token: string): Promise<{ valid: boolean; user: SSOUser | null }> {
  try {
    const { ssoUrl } = getConfig()
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

export async function getSession(request: NextRequest): Promise<SSOUser | null> {
  const token = extractToken(request)
  if (!token) return null

  const { valid, user } = await getUserInfo(token)
  return valid ? user : null
}

export function createAuthMiddleware() {
  return async (request: NextRequest) => {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { valid, user } = await getUserInfo(token)
    if (!valid || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    return { user, payload }
  }
}

export function createProtectedRoute<T>(
  handler: (request: NextRequest, user: SSOUser) => Promise<T>
) {
  return async (request: NextRequest) => {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { valid, user } = await getUserInfo(token)
    if (!valid || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return handler(request, user)
  }
}

export function createAdminRoute<T>(
  handler: (request: NextRequest, user: SSOUser) => Promise<T>
) {
  return async (request: NextRequest) => {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { valid, user } = await getUserInfo(token)
    if (!valid || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return handler(request, user)
  }
}

export function parseTokenFromCallback(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const { searchParams } = new URL(request.url)
  return searchParams.get('sso_token') || searchParams.get('token') || request.cookies.get('auth_token')?.value || null
}
