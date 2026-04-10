import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  const cookieDomain = process.env.SSO_COOKIE_DOMAIN || '.dev.aimstek.cn'
  response.cookies.set('auth_token', '', {
    expires: new Date(0),
    path: '/',
    domain: cookieDomain,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
  })
  return response
}