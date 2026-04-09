import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { fetchKnowledges, fetchLocalKnowledges } from '@/lib/knowledge';
import prisma from '@/lib/db';
import { authenticate } from '@/lib/auth';
import type { KnowledgeListResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('search') || '';
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const pageNum = parseInt(searchParams.get('page') || '1', 10);

    const [externalResult, localResult] = await Promise.allSettled([
      fetchKnowledges({ keyword, page: pageNum, pageSize }),
      fetchLocalKnowledges({ keyword }),
    ]);

    const externalKnowledges = externalResult.status === 'fulfilled' ? externalResult.value.knowledges : [];
    const localKnowledges = localResult.status === 'fulfilled' ? localResult.value.knowledges : [];

    const allKnowledges = [...localKnowledges, ...externalKnowledges];
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
    const { name, description, content } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse('请输入知识名称');
    }

    const knowledge = await prisma.knowledge.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        content: content?.trim() || null,
        createdBy: user.id,
      },
    });

    return successResponse({
      id: knowledge.id,
      name: knowledge.name,
      description: knowledge.description,
      content: knowledge.content,
      createdAt: knowledge.createdAt.toISOString(),
      updatedAt: knowledge.updatedAt.toISOString(),
    }, '创建成功');
  } catch (err) {
    console.error('Create knowledge error:', err);
    return errorResponse('创建失败');
  }
}