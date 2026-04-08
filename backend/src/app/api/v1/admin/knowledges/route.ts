import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    if (user.role !== 'ADMIN') {
      return errorResponse('无权限', 403);
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';

    const where = keyword
      ? {
          OR: [
            { name: { contains: keyword } },
            { description: { contains: keyword } },
          ],
        }
      : {};

    const knowledges = await prisma.knowledge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { name: true, email: true },
        },
      },
    });

    const formatted = knowledges.map((k) => ({
      id: k.id,
      name: k.name,
      description: k.description,
      content: k.content,
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
      createdBy: k.createdBy,
      creatorName: k.creator.name,
      creatorEmail: k.creator.email,
    }));

    return successResponse({
      knowledges: formatted,
      total: formatted.length,
    }, '获取成功');
  } catch (err) {
    console.error('Admin get knowledges error:', err);
    return errorResponse('获取失败');
  }
}