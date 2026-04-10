import { NextRequest, NextResponse } from 'next/server'
import { ssoClient } from '@/lib/sso'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  const baseUrl = appUrl || request.url

  console.log('[OAuth Callback] Received callback:', { code: code?.substring(0, 20) + '...', state, error })

  if (error) {
    console.log('[OAuth Callback] Error from SSO:', error)
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, baseUrl))
  }

  if (!code) {
    console.log('[OAuth Callback] No code provided')
    return NextResponse.redirect(new URL('/login?error=no_code', baseUrl))
  }

  try {
    const codeVerifier = request.cookies.get('code_verifier')?.value
    console.log('[OAuth Callback] Code verifier present:', !!codeVerifier)

    if (!codeVerifier) {
      console.log('[OAuth Callback] Missing code verifier')
      return NextResponse.redirect(new URL('/login?error=no_verifier', baseUrl))
    }

    console.log('[OAuth Callback] Exchanging code for tokens...')
    const tokens = await ssoClient.exchangeCode(code, codeVerifier)
    console.log('[OAuth Callback] Token received:', tokens.access_token?.substring(0, 20) + '...')

    const redirectUrl = new URL('/skills', baseUrl)
    const response = NextResponse.redirect(redirectUrl)

    response.cookies.set('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in || 3600,
      path: '/',
    })

    if (tokens.refresh_token) {
      response.cookies.set('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

    response.cookies.delete('code_verifier')

    return response
  } catch (err) {
    console.error('[OAuth Callback] Error:', err)
    return NextResponse.redirect(new URL('/login?error=callback_failed', baseUrl))
  }
}