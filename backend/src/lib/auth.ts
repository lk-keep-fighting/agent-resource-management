import { NextRequest } from 'next/server';
import crypto from 'crypto';
import prisma from './db';
import { errorResponse } from './api-response';
import { getUserInfo } from 'xuanwu-sso-sdk';
import type { User } from '@/lib/types';

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function authenticateBySSO(request: NextRequest): Promise<User | null> {
  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) return null;

  try {
    const userInfoResult = await getUserInfo(accessToken)
    if (!userInfoResult.valid || !userInfoResult.user) {
      return null;
    }
    const userInfo = userInfoResult.user

    let localUser = await prisma.user.findUnique({
      where: { ssoUserId: userInfo.id },
      select: {
        id: true,
        name: true,
        email: true,
        ssoUserId: true,
        role: true,
        createdAt: true,
      },
    });

    if (!localUser && userInfo.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: userInfo.email },
        select: { id: true, name: true, email: true, ssoUserId: true, role: true, createdAt: true }
      });

      if (byEmail) {
        localUser = await prisma.user.update({
          where: { id: byEmail.id },
          data: { ssoUserId: userInfo.id },
          select: { id: true, name: true, email: true, ssoUserId: true, role: true, createdAt: true }
        });
      }
    }

    if (!localUser) {
      localUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          ssoUserId: userInfo.id,
          name: userInfo.name || 'SSO User',
          email: userInfo.email || null,
        },
        select: { id: true, name: true, email: true, ssoUserId: true, role: true, createdAt: true }
      });
    }

    return {
      id: localUser.id,
      name: localUser.name || '',
      email: localUser.email || '',
      apiKey: localUser.ssoUserId || '',
      role: localUser.role,
      createdAt: localUser.createdAt.toISOString(),
    };
  } catch (err) {
    console.error('[auth] SSO auth error:', err);
    return null;
  }
}

async function authenticateByApiKey(request: NextRequest): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const apiKeyHash = hashApiKey(token);

  const user = await prisma.user.findUnique({
    where: { apiKeyHash },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    apiKey: apiKeyHash,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function authenticate(
  request: NextRequest
): Promise<User | null> {
  let user = await authenticateBySSO(request);
  if (user) return user;

  user = await authenticateByApiKey(request);
  return user;
}

export async function requireAuth(
  request: NextRequest
): Promise<{ user: User; request: NextRequest } | Response> {
  const user = await authenticate(request);
  if (!user) {
    return errorResponse('未授权', 401);
  }
  return { user, request };
}