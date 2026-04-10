import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { parseTokenFromCallback } from '@/lib/sso-client';
import prisma from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = parseTokenFromCallback(request);
    if (!token) {
      return errorResponse('Missing token', 400);
    }

    const jwtSecret = process.env.SSO_JWT_SECRET;
    if (!jwtSecret) {
      return errorResponse('Server config error', 500);
    }

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch {
      return errorResponse('Invalid token', 401);
    }

    if (typeof payload === 'string' || !payload.userId) {
      return errorResponse('Invalid token', 401);
    }

    let localUser = await prisma.user.findUnique({
      where: { ssoUserId: payload.userId },
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
          ssoUserId: payload.userId,
          feishuUnionId: payload.feishuUnionId || null,
          name: 'SSO User',
          email: `sso_${payload.userId}@local`,
          role: payload.role || 'USER',
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

    return successResponse({
      user: {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        role: localUser.role,
        createdAt: localUser.createdAt.toISOString(),
      },
    }, '登录成功');
  } catch (err) {
    console.error('SSO callback error:', err);
    return errorResponse('登录失败', 500);
  }
}