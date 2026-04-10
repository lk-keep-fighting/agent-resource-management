import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    return NextResponse.json({ valid: false, user: null }, { status: 401 })
  }

  const jwtSecret = process.env.SSO_JWT_SECRET
  if (!jwtSecret) {
    return NextResponse.json({ valid: false, user: null }, { status: 401 })
  }

  let payload: jwt.JwtPayload | string
  try {
    payload = jwt.verify(token, jwtSecret)
  } catch {
    return NextResponse.json({ valid: false, user: null }, { status: 401 })
  }

  if (typeof payload === 'string' || !payload.userId) {
    return NextResponse.json({ valid: false, user: null }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { ssoUserId: payload.userId },
    select: { id: true, name: true, email: true, role: true }
  })

  if (!user) {
    return NextResponse.json({ valid: false, user: null }, { status: 401 })
  }

  return NextResponse.json({
    valid: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }
  })
}