import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { hashApiKey, hashPassword, encryptApiKey } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return errorResponse('邮箱和密码不能为空');
    }

    if (password.length < 8) {
      return errorResponse('密码至少需要 8 个字符');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('邮箱格式不正确');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return errorResponse('该邮箱已被注册');
    }

    const apiKey = crypto.randomUUID().replace(/-/g, '');
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email,
        name: name || email.split('@')[0],
        passwordHash: hashPassword(password),
        apiKeyHash: hashApiKey(apiKey),
        encryptedApiKey: encryptApiKey(apiKey),
        ssoUserId: '',
      } as any,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return successResponse({
      user: {
        ...user,
        apiKey,
        createdAt: user.createdAt.toISOString(),
      },
      token: apiKey,
    }, '注册成功');
  } catch (err) {
    console.error('Register error:', err);
    return errorResponse('注册失败');
  }
}