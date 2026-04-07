import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { parseTokenFromCallback, getUserInfo } from '@/lib/sso-client';
import prisma from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import type { User, LoginResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = parseTokenFromCallback(request);
    if (!token) {
      return errorResponse('Missing token', 400);
    }

    const { valid, user: ssoUser } = await getUserInfo(token);
    if (!valid || !ssoUser) {
      return errorResponse('SSO authentication failed', 401);
    }

    let localUser = await prisma.user.findUnique({
      where: { ssoUserId: ssoUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        ssoUserId: true,
        feishuUnionId: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!localUser) {
      localUser = await prisma.user.create({
        data: {
          id: uuidv4(),
          ssoUserId: ssoUser.id,
          feishuUnionId: ssoUser.feishuUnionId,
          name: ssoUser.name || 'Unknown',
          email: ssoUser.email || `${ssoUser.id}@sso.local`,
          avatarUrl: ssoUser.avatarUrl,
          role: ssoUser.role,
        },
        select: {
          id: true,
          name: true,
          email: true,
          ssoUserId: true,
          feishuUnionId: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
    }

    const response = successResponse({
      user: {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        ssoUserId: localUser.ssoUserId,
        createdAt: localUser.createdAt.toISOString(),
      },
    }, '登录成功');

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('SSO callback error:', err);
    return errorResponse('登录失败', 500);
  }
}
