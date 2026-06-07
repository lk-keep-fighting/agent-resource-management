import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, decryptApiKey } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import type { LoginResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('邮箱和密码不能为空');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        passwordHash: true,
        encryptedApiKey: true,
      },
    });

    if (!user || !user.passwordHash) {
      return errorResponse('邮箱或密码错误', 401);
    }

    if (user.passwordHash !== hashPassword(password)) {
      return errorResponse('邮箱或密码错误', 401);
    }

    if (!user.encryptedApiKey) {
      return errorResponse('该账号未生成 API Key，请联系管理员', 500);
    }

    const apiKey = decryptApiKey(user.encryptedApiKey);

    const response: LoginResponse = {
      user: {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        apiKey,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      token: apiKey,
    };

    return successResponse(response, '登录成功');
  } catch (err) {
    console.error('Password login error:', err);
    return errorResponse('登录失败');
  }
}
