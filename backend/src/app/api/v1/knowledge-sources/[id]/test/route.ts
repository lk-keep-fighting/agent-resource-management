import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { authenticate } from '@/lib/auth';
import { fetchExternalSourceById, testExternalSource } from '@/lib/knowledge-source';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const { id } = await params;
    const source = await fetchExternalSourceById(id);
    if (!source) {
      return errorResponse('配置不存在', 404);
    }

    const result = await testExternalSource(source);

    if (result.success) {
      return successResponse(result, '测试成功');
    } else {
      return errorResponse(result.message, 400);
    }
  } catch (err) {
    console.error('Test external source error:', err);
    return errorResponse('测试失败');
  }
}