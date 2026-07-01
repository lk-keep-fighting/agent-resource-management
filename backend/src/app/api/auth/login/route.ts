import { NextRequest, NextResponse } from 'next/server';

const feishuAppId = process.env.FEISHU_APP_ID || '';
const feishuRedirectUri = process.env.FEISHU_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

/**
 * GET /api/auth/login?next=/some/path  →  302 to Feishu authorize endpoint
 *
 * 直接对接飞书新版 OIDC 登录（open.feishu.cn/open-apis/authen/v1/index）。
 * 不再用 CASDOOR 中转、不再用 xuanwu-sso-sdk。
 *
 * `state` 编码 next（同域 dashboard）或 wsCallback（跨域 workstation）。
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') || '/dashboard';
  const wsCallback = request.nextUrl.searchParams.get('wsCallback');

  const state = Buffer.from(JSON.stringify({ next, wsCallback })).toString('base64url');

  // 飞书新版 OIDC 授权端点
  const authorizeUrl = new URL('https://open.feishu.cn/open-apis/authen/v1/index');
  authorizeUrl.searchParams.set('app_id', feishuAppId);
  authorizeUrl.searchParams.set('redirect_uri', feishuRedirectUri);
  authorizeUrl.searchParams.set('state', state);
  // open_id 用作 UserIdentity.providerUserId；profile/email 取名字和邮箱
  authorizeUrl.searchParams.set('scope', 'open_id profile email');

  return NextResponse.redirect(authorizeUrl.toString());
}