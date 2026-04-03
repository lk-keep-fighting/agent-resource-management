import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { fetchKnowledgeById } from '@/lib/knowledge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const knowledge = await fetchKnowledgeById(id);

    if (!knowledge) {
      return errorResponse('Knowledge不存在', 404);
    }

    return successResponse(knowledge, '获取成功');
  } catch (err) {
    console.error('Get knowledge error:', err);
    return errorResponse('获取失败');
  }
}