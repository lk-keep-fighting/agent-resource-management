import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { fetchUserKnowledges } from '@/lib/knowledge';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const knowledges = await fetchUserKnowledges(user.id);

    return successResponse(knowledges, '获取成功');
  } catch (err) {
    console.error('Get my knowledges error:', err);
    return errorResponse('获取失败');
  }
}