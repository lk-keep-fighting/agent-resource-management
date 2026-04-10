import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export interface TokenPayload {
  userId: string
  feishuUnionId: string
  role: string
}

function getJwtSecret(): string {
  const jwtSecret = process.env.SSO_JWT_SECRET
  if (!jwtSecret) {
    throw new Error('Missing SSO_JWT_SECRET environment variable')
  }
  return jwtSecret
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
    const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload
    if (!payload.userId) return null
    return {
      userId: payload.userId,
      feishuUnionId: payload.feishuUnionId || '',
      role: payload.role || 'USER'
    }
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

export function parseTokenFromCallback(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const { searchParams } = new URL(request.url)
  return searchParams.get('sso_token') || searchParams.get('token') || request.cookies.get('auth_token')?.value || null
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

    return { payload }
  }
}

export function createProtectedRoute<T>(
  handler: (request: NextRequest, payload: TokenPayload) => Promise<T>
) {
  return async (request: NextRequest) => {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return handler(request, payload)
  }
}

export function createAdminRoute<T>(
  handler: (request: NextRequest, payload: TokenPayload) => Promise<T>
) {
  return async (request: NextRequest) => {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return handler(request, payload)
  }
}