import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { hashApiKey } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import type { User, LoginResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return errorResponse('API Key 不能为空');
    }

    const apiKeyHash = hashApiKey(apiKey);
    const users = await query<User[]>(
      'SELECT id, name, email, api_key_hash as apiKey, created_at as createdAt FROM users WHERE api_key_hash = ?',
      [apiKeyHash]
    );

    if (users.length === 0) {
      return errorResponse('无效的 API Key', 401);
    }

    const user = users[0];
    const response: LoginResponse = {
      user,
      token: apiKey,
    };

    return successResponse(response, '登录成功');
  } catch (err) {
    console.error('Login error:', err);
    return errorResponse('登录失败');
  }
}