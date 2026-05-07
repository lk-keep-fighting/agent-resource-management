import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { authenticate } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'alpha';

    let orderBy: any = { name: 'asc' };
    if (sort === 'hot') {
      orderBy = { skillTags: { _count: 'desc' } };
    } else if (sort === 'recent') {
      orderBy = { createdAt: 'desc' };
    }

    const tags = await prisma.tag.findMany({
      orderBy,
      include: {
        _count: {
          select: {
            skillTags: true,
            knowledgeTags: true,
          },
        },
      },
    });

    const tagsFormatted = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      skillCount: tag._count.skillTags,
      knowledgeCount: tag._count.knowledgeTags,
      createdAt: tag.createdAt.toISOString(),
    }));

    return successResponse(tagsFormatted, '获取成功');
  } catch (err) {
    console.error('Get tags error:', err);
    return successResponse([], '获取成功');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse('请输入标签名称');
    }

    const tagName = name.trim().toLowerCase();
    if (tagName.length > 50) {
      return errorResponse('标签名称不能超过50个字符');
    }

    const tag = await prisma.tag.create({
      data: { name: tagName },
    });

    return successResponse({
      id: tag.id,
      name: tag.name,
      createdAt: tag.createdAt.toISOString(),
    }, '创建成功');
  } catch (err: any) {
    if (err.code === 'P2002') {
      return errorResponse('标签已存在');
    }
    console.error('Create tag error:', err);
    return errorResponse('创建失败');
  }
}