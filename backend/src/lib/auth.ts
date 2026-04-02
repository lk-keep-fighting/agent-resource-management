import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { query } from './db';
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

  const users = await query<User[]>(
    'SELECT id, name, email, api_key_hash as apiKey, created_at as createdAt FROM users WHERE api_key_hash = ?',
    [apiKeyHash]
  );

  if (users.length === 0) {
    return null;
  }

  return users[0];
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