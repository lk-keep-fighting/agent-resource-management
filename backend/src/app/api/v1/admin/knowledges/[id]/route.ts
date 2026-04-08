import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    if (user.role !== 'ADMIN') {
      return errorResponse('无权限', 403);
    }

    const { id } = await params;

    const knowledge = await prisma.knowledge.findUnique({
      where: { id },
    });

    if (!knowledge) {
      return errorResponse('知识不存在', 404);
    }

    await prisma.knowledge.delete({
      where: { id },
    });

    return successResponse(null, '删除成功');
  } catch (err) {
    console.error('Admin delete knowledge error:', err);
    return errorResponse('删除失败');
  }
}