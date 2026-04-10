import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  let token: string | null | undefined = request.cookies.get('auth_token')?.value

  if (!token) {
    token = request.nextUrl.searchParams.get('sso_token')
  }

  if (!token) {
    return NextResponse.json({ user: null })
  }

  const jwtSecret = process.env.SSO_JWT_SECRET
  if (!jwtSecret) {
    return NextResponse.json({ user: null })
  }

  let payload: jwt.JwtPayload | string
  try {
    payload = jwt.verify(token, jwtSecret)
  } catch {
    return NextResponse.json({ user: null })
  }

  if (typeof payload === 'string' || !payload.userId) {
    return NextResponse.json({ user: null })
  }

  const user = await prisma.user.findUnique({
    where: { ssoUserId: payload.userId },
    select: { id: true, name: true, email: true, avatarUrl: true, role: true }
  })

  const response = NextResponse.json({ user })

  const hasCookie = request.cookies.get('auth_token')?.value
  if (!hasCookie) {
    const cookieDomain = process.env.SSO_COOKIE_DOMAIN || undefined
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      domain: cookieDomain,
    })
  }

  return response
}