import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { fetchKnowledges, fetchLocalKnowledges } from '@/lib/knowledge';
import prisma from '@/lib/db';
import { authenticate } from '@/lib/auth';
import type { KnowledgeListResponse } from '@/lib/types';
import { Prisma } from '@prisma/client';
import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

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

    const contentType = request.headers.get('content-type') || '';
    let name = '';
    let description: string | null = null;
    let content: string | null = null;
    let tags: string[] = [];

    console.log('DEBUG contentType:', contentType);

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      console.log('DEBUG formData file:', file, file?.name);
      if (file) {
        name = file.name.replace(/\.(md|zip)$/i, '');
        const buffer = Buffer.from(await file.arrayBuffer());
        content = buffer.toString('utf-8');
      } else {
        name = (formData.get('name') as string) || '';
        description = (formData.get('description') as string) || null;
        content = (formData.get('content') as string) || null;
      }
      console.log('DEBUG parsed name:', name);
    } else {
      let body;
      try {
        body = await request.json();
      } catch {
        return errorResponse('请求格式错误，请检查 JSON 格式');
      }
      name = body?.name || '';
      description = body?.description;
      content = body?.content;
      tags = body?.tags || [];
    }

    console.log('DEBUG final name:', name);

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

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const shareUrl = `${protocol}://${host}/knowledges/${knowledge.id}`;

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
      shareUrl,
    }, '创建成功');
  } catch (err: any) {
    console.error('Create knowledge error:', err);
    if (err?.code === 'P2002') {
      return errorResponse('知识名称已存在，请使用其他名称');
    }
    return errorResponse(`创建失败: ${err?.message || String(err)}`);
  }
}