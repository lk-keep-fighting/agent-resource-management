import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { fetchKnowledgeById, deleteKnowledge } from '@/lib/knowledge';
import { authenticate } from '@/lib/auth';

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const { id } = await params;
    const prisma = require('@/lib/db').default;
    const knowledge = await prisma.knowledge.findUnique({
      where: { id },
    });

    if (!knowledge) {
      return errorResponse('知识不存在', 404);
    }

    if (knowledge.createdBy !== user.id) {
      return errorResponse('无权限删除', 403);
    }

    await deleteKnowledge(id);

    return successResponse(null, '删除成功');
  } catch (err) {
    console.error('Delete knowledge error:', err);
    return errorResponse('删除失败');
  }
}