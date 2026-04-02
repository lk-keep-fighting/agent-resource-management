import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const user = await authenticate(request);

  if (!user) {
    return errorResponse('未授权', 401);
  }

  return successResponse(user, '获取用户信息成功');
}