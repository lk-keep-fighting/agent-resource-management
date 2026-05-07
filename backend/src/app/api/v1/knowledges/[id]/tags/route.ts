import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { authenticate } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const knowledge = await prisma.knowledge.findUnique({
      where: { id },
      include: {
        knowledgeTags: {
          include: { tag: true },
        },
      },
    });

    if (!knowledge) {
      return errorResponse('知识不存在');
    }

    const tags = knowledge.knowledgeTags.map((kt) => ({
      id: kt.tag.id,
      name: kt.tag.name,
    }));

    return successResponse(tags, '获取成功');
  } catch (err) {
    console.error('Get knowledge tags error:', err);
    return errorResponse('获取失败');
  }
}

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
    const body = await request.json();
    const { tags } = body;

    if (!Array.isArray(tags)) {
      return errorResponse('tags 必须是数组');
    }

    const knowledge = await prisma.knowledge.findUnique({
      where: { id },
    });

    if (!knowledge) {
      return errorResponse('知识不存在');
    }

    if (knowledge.createdBy !== user.id) {
      return errorResponse('无权限修改');
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.knowledgeTag.deleteMany({
        where: { knowledgeId: id },
      });

      const createdTags = [];
      for (const tagName of tags) {
        if (typeof tagName !== 'string' || !tagName.trim()) continue;
        const normalizedTag = tagName.trim().toLowerCase();
        const tag = await tx.tag.upsert({
          where: { name: normalizedTag },
          create: { name: normalizedTag },
          update: {},
        });
        await tx.knowledgeTag.create({
          data: { knowledgeId: id, tagId: tag.id },
        });
        createdTags.push({ id: tag.id, name: tag.name });
      }

      return createdTags;
    });

    return successResponse(result, '更新成功');
  } catch (err) {
    console.error('Update knowledge tags error:', err);
    return errorResponse('更新失败');
  }
}