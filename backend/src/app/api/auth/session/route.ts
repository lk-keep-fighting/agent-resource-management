import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

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

  await prisma.user.upsert({
    where: { ssoUserId: payload.userId },
    create: {
      id: uuidv4(),
      ssoUserId: payload.userId,
      name: 'SSO User',
      email: `sso_${payload.userId}@local`,
    },
    update: {},
  })

  const user = await prisma.user.findUnique({
    where: { ssoUserId: payload.userId },
    select: { id: true, name: true, email: true, avatarUrl: true, role: true }
  })

  return NextResponse.json({ user })
}