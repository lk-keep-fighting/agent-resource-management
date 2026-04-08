import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { hashApiKey } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import type { LoginResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return errorResponse('API Key 不能为空');
    }

    const apiKeyHash = hashApiKey(apiKey);
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
      return errorResponse('无效的 API Key', 401);
    }

    const response: LoginResponse = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        apiKey: apiKeyHash,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      token: apiKey,
    };

    return successResponse(response, '登录成功');
  } catch (err) {
    console.error('Login error:', err);
    return errorResponse('登录失败');
  }
}
