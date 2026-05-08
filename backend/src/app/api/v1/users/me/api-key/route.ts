import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { decryptApiKey } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
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
      select: { id: true, encryptedApiKey: true },
    });

    if (!user) {
      return errorResponse('用户不存在', 404);
    }

    if (!user.encryptedApiKey) {
      return successResponse({ hasApiKey: false, apiKey: null }, '未生成API Key');
    }

    const apiKey = decryptApiKey(user.encryptedApiKey);
    return successResponse({ hasApiKey: true, apiKey }, 'API Key获取成功');
  } catch (err) {
    console.error('[api-key/get] error:', err);
    return errorResponse('获取失败');
  }
}