import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { ssoClient } from '@/lib/sso'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value

  if (!accessToken) {
    return NextResponse.json({ user: null })
  }

  try {
    const userInfo = await ssoClient.getUserInfo(accessToken)
    console.log('[Session] userInfo:', userInfo)

    let localUser = await prisma.user.findUnique({
      where: { ssoUserId: userInfo.sub },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true }
    })
    console.log('[Session] found by ssoUserId:', localUser)

    if (!localUser && userInfo.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: userInfo.email },
        select: { id: true, name: true, email: true, avatarUrl: true, role: true }
      })
      console.log('[Session] found by email:', byEmail)
      
      if (byEmail) {
        localUser = await prisma.user.update({
          where: { id: byEmail.id },
          data: { ssoUserId: userInfo.sub },
          select: { id: true, name: true, email: true, avatarUrl: true, role: true }
        })
        console.log('[Session] updated by email, new user:', localUser)
      }
    }

    if (!localUser) {
      console.log('[Session] creating new user with:', {
        ssoUserId: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email
      })
      localUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          ssoUserId: userInfo.sub,
          name: userInfo.name || 'SSO User',
          email: userInfo.email || null,
        },
        select: { id: true, name: true, email: true, avatarUrl: true, role: true }
      })
      console.log('[Session] created user:', localUser)
    }

    return NextResponse.json({ user: localUser })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({ user: null })
  }
}