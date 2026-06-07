import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getUserInfo } from 'xuanwu-sso-sdk'
import { hashApiKey } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value

  if (!accessToken) {
    return NextResponse.json({ user: null })
  }

  const isJwt = accessToken.includes('.')

  if (!isJwt) {
    try {
      const apiKeyHash = hashApiKey(accessToken)
      const localUser = await prisma.user.findUnique({
        where: { apiKeyHash },
        select: { id: true, name: true, email: true, avatarUrl: true, role: true }
      })
      if (localUser) {
        return NextResponse.json({ user: localUser })
      }
      return NextResponse.json({ user: null })
    } catch (error) {
      console.error('Session api-key error:', error)
      return NextResponse.json({ user: null })
    }
  }

  try {
    const userInfo = await getUserInfo(accessToken)
    console.log('[Session] userInfo:', userInfo)

    if (!userInfo.valid || !userInfo.user) {
      console.log('[Session] invalid user info')
      return NextResponse.json({ user: null })
    }

    let localUser = await prisma.user.findUnique({
      where: { ssoUserId: userInfo.user.id },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true }
    })
    console.log('[Session] found by ssoUserId:', localUser)

    if (!localUser && userInfo.user.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: userInfo.user.email },
        select: { id: true, name: true, email: true, avatarUrl: true, role: true }
      })
      console.log('[Session] found by email:', byEmail)

      if (byEmail) {
        localUser = await prisma.user.update({
          where: { id: byEmail.id },
          data: { ssoUserId: userInfo.user.id },
          select: { id: true, name: true, email: true, avatarUrl: true, role: true }
        })
        console.log('[Session] updated by email, new user:', localUser)
      }
    }

    if (!localUser) {
      console.log('[Session] creating new user with:', {
        ssoUserId: userInfo.user.id,
        name: userInfo.user.name,
        email: userInfo.user.email
      })
      localUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          ssoUserId: userInfo.user.id,
          name: userInfo.user.name || 'SSO User',
          email: userInfo.user.email || null,
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
