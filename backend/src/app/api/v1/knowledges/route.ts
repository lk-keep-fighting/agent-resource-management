import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { fetchKnowledges, fetchLocalKnowledges } from '@/lib/knowledge';
import prisma from '@/lib/db';
import { authenticate } from '@/lib/auth';
import type { KnowledgeListResponse } from '@/lib/types';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('search') || '';
    const tagsParam = searchParams.get('tags') || '';
    const tagMode = searchParams.get('tagMode') || 'or';
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const pageNum = parseInt(searchParams.get('page') || '1', 10);

    const tags = tagsParam
      ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const localWhere: Prisma.KnowledgeWhereInput = {
      ...(keyword ? { name: { contains: keyword } } : {}),
      ...(tags.length > 0
        ? {
            knowledgeTags:
              tagMode === 'and'
                ? { some: { tag: { name: { in: tags } } }, every: { tag: { name: { in: tags } } } }
                : { some: { tag: { name: { in: tags } } } },
          }
        : {}),
    };

    const [externalResult, localResult] = await Promise.allSettled([
      fetchKnowledges({ keyword, page: pageNum, pageSize }),
      fetchLocalKnowledges({ keyword, tags, tagMode }),
    ]);

    const externalKnowledges = externalResult.status === 'fulfilled' ? externalResult.value.knowledges : [];
    const localKnowledges = localResult.status === 'fulfilled' ? localResult.value.knowledges : [];

    let allKnowledges;
    if (tags.length > 0) {
      allKnowledges = localKnowledges;
    } else {
      allKnowledges = [...localKnowledges, ...externalKnowledges];
    }
    const response: KnowledgeListResponse = {
      knowledges: allKnowledges,
      total: allKnowledges.length,
      page: pageNum,
      pageSize: pageSize,
    };

    return successResponse(response, '获取成功');
  } catch (err) {
    console.error('Get knowledges error:', err);
    const response: KnowledgeListResponse = {
      knowledges: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };
    return successResponse(response, '知识服务不可用');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const body = await request.json();
    const { name, description, content, tags } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse('请输入知识名称');
    }

    const knowledge = await prisma.$transaction(async (tx) => {
      const created = await tx.knowledge.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          content: content?.trim() || null,
          createdBy: user.id,
        },
      });

      if (Array.isArray(tags) && tags.length > 0) {
        for (const tagName of tags) {
          if (typeof tagName !== 'string' || !tagName.trim()) continue;
          const normalizedTag = tagName.trim().toLowerCase();
          const tag = await tx.tag.upsert({
            where: { name: normalizedTag },
            create: { name: normalizedTag },
            update: {},
          });
          await tx.knowledgeTag.create({
            data: { knowledgeId: created.id, tagId: tag.id },
          });
        }
      }

      return created;
    });

    const knowledgeWithTags = await prisma.knowledge.findUnique({
      where: { id: knowledge.id },
      include: {
        knowledgeTags: { include: { tag: true } },
      },
    });

    return successResponse({
      id: knowledgeWithTags!.id,
      name: knowledgeWithTags!.name,
      description: knowledgeWithTags!.description,
      content: knowledgeWithTags!.content,
      tags: knowledgeWithTags!.knowledgeTags.map((kt) => kt.tag.name),
      createdAt: knowledgeWithTags!.createdAt.toISOString(),
      updatedAt: knowledgeWithTags!.updatedAt.toISOString(),
    }, '创建成功');
  } catch (err) {
    console.error('Create knowledge error:', err);
    return errorResponse('创建失败');
  }
}