import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { authenticate } from '@/lib/auth';
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

    const { id } = await params;

    const tag = await prisma.tag.findUnique({
      where: { id },
    });

    if (!tag) {
      return errorResponse('标签不存在');
    }

    await prisma.tag.delete({
      where: { id },
    });

    return successResponse({ id: tag.id }, '删除成功');
  } catch (err) {
    console.error('Delete tag error:', err);
    return errorResponse('删除失败');
  }
}