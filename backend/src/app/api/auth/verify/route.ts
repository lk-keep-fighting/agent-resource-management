import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUserInfo } from 'xuanwu-sso-sdk'
import prisma from '@/lib/db'

/**
 * POST /api/auth/verify
 * Body: { token: string }
 *
 * 给 ARM /auth/callback page 用 —— 验证 SSO token + 同步/创建 local user 后返回。
 * 因为浏览器跨域不能直接调 SSO /api/auth/userinfo，所以走后端中转。
 *
 * 返回的 user.id 是 ARM DB 的 local user.id（用于跨系统身份对齐）。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { token?: string };
    if (!body.token) {
      return NextResponse.json({ valid: false, user: null, msg: "token 必填" }, { status: 400 });
    }

    const userInfo = await getUserInfo(body.token);
    if (!userInfo.valid || !userInfo.user) {
      return NextResponse.json({ valid: false, user: null, msg: "invalid_token" });
    }

    const u = userInfo.user;

    // 同步/创建 ARM local user（跟 auth.ts:authenticateBySSO 逻辑保持一致）
    let localUser = await prisma.user.findUnique({
      where: { ssoUserId: u.id },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    });

    if (!localUser && u.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: u.email },
        select: { id: true, name: true, email: true, role: true, avatarUrl: true },
      });
      if (byEmail) {
        localUser = await prisma.user.update({
          where: { id: byEmail.id },
          data: { ssoUserId: u.id },
          select: { id: true, name: true, email: true, role: true, avatarUrl: true },
        });
      }
    }

    if (!localUser) {
      localUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          ssoUserId: u.id,
          name: u.name || 'SSO User',
          email: u.email || null,
          avatarUrl: u.avatarUrl || null,
        },
        select: { id: true, name: true, email: true, role: true, avatarUrl: true },
      });
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        role: localUser.role,
        avatarUrl: localUser.avatarUrl,
      },
    });
  } catch (err) {
    console.error("[auth/verify] error:", err);
    return NextResponse.json({ valid: false, user: null, msg: "verify_failed" }, { status: 500 });
  }
}
