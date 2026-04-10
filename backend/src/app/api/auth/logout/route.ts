import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('auth_token', '', {
    expires: new Date(0),
    path: '/',
    domain: '.dev.aimstek.cn',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
  })
  return response
}