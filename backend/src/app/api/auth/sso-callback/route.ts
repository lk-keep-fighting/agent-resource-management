import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const baseUrl = `${protocol}://${host}`

  let token = request.nextUrl.searchParams.get('sso_token')
  if (!token) {
    token = request.cookies.get('auth_token')?.value ?? null
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=no_token', baseUrl))
  }

  const jwtSecret = process.env.SSO_JWT_SECRET
  if (!jwtSecret) {
    return NextResponse.redirect(new URL('/login?error=server_config_error', baseUrl))
  }

  let payload: jwt.JwtPayload | string
  try {
    payload = jwt.verify(token, jwtSecret)
  } catch {
    return NextResponse.redirect(new URL('/login?error=invalid_token', baseUrl))
  }

  if (typeof payload === 'string' || !payload.userId) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', baseUrl))
  }

  await prisma.user.upsert({
    where: { ssoUserId: payload.userId },
    create: {
      id: uuidv4(),
      ssoUserId: payload.userId,
      name: 'SSO User',
      email: `sso_${payload.userId}@local`,
    },
    update: {}
  })

  return NextResponse.redirect(new URL('/', baseUrl))
}