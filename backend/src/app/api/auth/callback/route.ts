import { NextRequest, NextResponse } from 'next/server'
import { ssoClient } from '@/lib/sso'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

/**
 * SSO 回调处理（OAuth2 / PKCE 流程）
 *
 * ARM dashboard 的 SSO 登录由前端 useSSO + /auth/callback 页面处理（client-side）。
 * 本 API 路由是 OAuth2 标准流程的回调端点（code_verifier + exchangeCode），
 * 当前 ARM dashboard 不走本端点，本端点保留供标准 OAuth2 流程使用。
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  const baseUrl = appUrl || request.url

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, baseUrl))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', baseUrl))
  }

  try {
    const codeVerifier = request.cookies.get('code_verifier')?.value
    if (!codeVerifier) {
      return NextResponse.redirect(new URL('/login?error=no_verifier', baseUrl))
    }

    const tokens = await ssoClient.exchangeCode(code, codeVerifier)
    const accessToken = tokens.access_token
    if (!accessToken) throw new Error('No access_token from exchange')

    const redirectUrl = new URL('/skills', baseUrl)
    const response = NextResponse.redirect(redirectUrl)

    response.cookies.set('access_token', accessToken, {
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