import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { generatePAT, hashPAT } from '@/lib/auth';

const feishuAppId = process.env.FEISHU_APP_ID || '';
const feishuAppSecret = process.env.FEISHU_APP_SECRET || '';

// 飞书自建应用（cli_ 前缀）的 token endpoint 是 /authen/v1/access_token（接受 JSON + app_id/app_secret）。
// /oidc/access_token 那个 endpoint 期望 app_access_token header，不适用于此场景。
const FEISHU_TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v1/access_token';
const FEISHU_USERINFO_URL = 'https://open.feishu.cn/open-apis/authen/v1/user_info';

// 拿到本请求的 origin（用户访问 ARM 的实际地址），用于后续重定向回 ARM 自身。
function originOf(request: NextRequest): string {
  return request.nextUrl.origin;
}

/**
 * 飞书 OIDC 回调（兼容两种场景）：
 *   1) 同域 dashboard 登录：query 里有 `code` + `state` (next=...)，
 *      颁发 PAT 后 set cookie + 302 到 next
 *   2) 跨域 workstation 授权：query 里 `code` + `state` 含 wsCallback，
 *      颁发 PAT 后渲染一个中间页（JS 跳转到 ws callback #token=...）
 *
 * 直接调飞书 OIDC token endpoint + userinfo endpoint，不走任何 SDK / IdP 中转。
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorParam)}`, originOf(request)),
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', originOf(request)));
  }

  let decodedState: { next?: string; wsCallback?: string } = {};
  try {
    if (state) decodedState = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    // state 损坏视为普通登录
  }

  try {
    if (!feishuAppId || !feishuAppSecret) {
      throw new Error('FEISHU_APP_ID / FEISHU_APP_SECRET 未配置');
    }

    // 1. 用 code 换飞书 access_token（JSON body，app_id/app_secret 而非 client_id/client_secret）
    const tokenRes = await fetch(FEISHU_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        app_id: feishuAppId,
        app_secret: feishuAppSecret,
      }),
    });
    const tokenJson = (await tokenRes.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: { access_token?: string; expires_in?: number; refresh_token?: string };
    } | null;
    if (!tokenJson || tokenJson.code !== 0 || !tokenJson.data?.access_token) {
      throw new Error(`feishu token exchange failed: code=${tokenJson?.code} msg=${tokenJson?.msg}`);
    }
    const accessToken = tokenJson.data.access_token;

    // 2. 拉用户信息
    const userInfoRes = await fetch(FEISHU_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userInfoJson = (await userInfoRes.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: {
        union_id?: string;
        open_id?: string;
        user_id?: string;
        name?: string;
        en_name?: string;
        nickname?: string;
        email?: string;
        avatar_url?: string;
      };
    } | null;
    if (!userInfoJson || userInfoJson.code !== 0 || !userInfoJson.data) {
      throw new Error(`feishu userinfo failed: code=${userInfoJson?.code} msg=${userInfoJson?.msg}`);
    }
    const info = userInfoJson.data;
    const providerUserId = info.union_id || info.open_id || info.user_id;
    if (!providerUserId) {
      throw new Error('feishu userinfo missing union_id/open_id/user_id');
    }

    // 3. upsert User + UserIdentity
    const user = await prisma.$transaction(async (tx) => {
      const identity = await tx.userIdentity.findUnique({
        where: { provider_providerUserId: { provider: 'feishu', providerUserId } },
        include: { user: true },
      });
      if (identity) return identity.user;

      const newUser = await tx.user.create({
        data: {
          id: crypto.randomUUID(),
          name: info.name || info.nickname || info.en_name || providerUserId,
          email: info.email || null,
        },
      });
      await tx.userIdentity.create({
        data: {
          userId: newUser.id,
          provider: 'feishu',
          providerUserId,
          metadata: { raw: info },
        },
      });
      return newUser;
    });

    // 4. 颁发 PAT
    const pat = generatePAT();
    await prisma.userToken.create({
      data: {
        userId: user.id,
        name: decodedState.wsCallback ? `Workstation @ ${new Date().toISOString().slice(0, 10)}` : 'Dashboard session',
        tokenHash: hashPAT(pat),
      },
    });

    // 5. 分发
    if (decodedState.wsCallback) {
      // 跨域：渲染中间跳转页，把 PAT 放在 fragment 里（同源策略保证 hash 不被中间网络看到）
      const html = `<!doctype html><html><body><script>
        const url = ${JSON.stringify(decodedState.wsCallback)} + '#token=' + encodeURIComponent(${JSON.stringify(pat)});
        window.location.href = url;
      </script></body></html>`;
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 同域：set cookie + 302
    const next = decodedState.next || '/dashboard';
    const response = NextResponse.redirect(new URL(next, originOf(request)));
    response.cookies.set('arm_pat', pat, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch (err) {
    console.error('[callback] error:', err);
    return NextResponse.redirect(new URL('/login?error=callback_failed', originOf(request)));
  }
}