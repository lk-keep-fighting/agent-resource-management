import { NextRequest } from 'next/server';
import crypto from 'crypto';
import prisma from './db';
import { errorResponse } from './api-response';
import type { User } from '@/lib/types';

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export async function authenticate(
  request: NextRequest
): Promise<User | null> {
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
      createdAt: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    apiKey: apiKeyHash,
    createdAt: user.createdAt.toISOString(),
  };
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
