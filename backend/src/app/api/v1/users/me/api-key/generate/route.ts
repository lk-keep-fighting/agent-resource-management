import { NextRequest } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { hashApiKey } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
      return errorResponse('未登录', 401);
    }

    const { getUserInfo } = await import('xuanwu-sso-sdk');
    const userInfoResult = await getUserInfo(accessToken);

    if (!userInfoResult.valid || !userInfoResult.user) {
      return errorResponse('会话无效', 401);
    }

    const ssoUserId = userInfoResult.user.id;
    const user = await prisma.user.findUnique({
      where: { ssoUserId },
      select: { id: true },
    });

    if (!user) {
      return errorResponse('用户不存在', 404);
    }

    const apiKey = crypto.randomUUID().replace(/-/g, '');
    const apiKeyHash = hashApiKey(apiKey);

    await prisma.user.update({
      where: { id: user.id },
      data: { apiKeyHash },
    });

    return successResponse({ apiKey }, 'API Key 已生成，请妥善保管');
  } catch (err) {
    console.error('[api-key/generate] error:', err);
    return errorResponse('生成失败');
  }
}