import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { fetchKnowledgeById, deleteKnowledge } from '@/lib/knowledge';
import { authenticate } from '@/lib/auth';
import prisma from '@/lib/db';

interface UpdateKnowledgeRequest {
  name?: string;
  description?: string;
  content?: string;
  tags?: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const knowledge = await prisma.knowledge.findUnique({
      where: { id },
      include: {
        knowledgeTags: { include: { tag: true } },
      },
    });

    if (!knowledge) {
      const marketKnowledge = await fetchKnowledgeById(id);
      if (!marketKnowledge) {
        return errorResponse('Knowledge不存在', 404);
      }
      return successResponse(marketKnowledge, '获取成功');
    }

    return successResponse({
      id: knowledge.id,
      name: knowledge.name,
      description: knowledge.description,
      content: knowledge.content,
      tags: knowledge.knowledgeTags.map((kt) => kt.tag.name),
      createdAt: knowledge.createdAt.toISOString(),
      updatedAt: knowledge.updatedAt.toISOString(),
    }, '获取成功');
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

    if (knowledge.createdBy !== user.id && user.role !== 'ADMIN') {
      return errorResponse('无权限删除', 403);
    }

    await deleteKnowledge(id);

    return successResponse(null, '删除成功');
  } catch (err) {
    console.error('Delete knowledge error:', err);
    return errorResponse('删除失败');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const { id } = await params;
    const body: UpdateKnowledgeRequest = await request.json();

    const knowledge = await prisma.knowledge.findUnique({
      where: { id },
    });

    if (!knowledge) {
      return errorResponse('知识不存在', 404);
    }

    if (knowledge.createdBy !== user.id && user.role !== 'ADMIN') {
      return errorResponse('无权限修改', 403);
    }

    const updateData: any = {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.content !== undefined && { content: body.content?.trim() || null }),
    };

    if (body.tags !== undefined) {
      await prisma.knowledgeTag.deleteMany({
        where: { knowledgeId: id },
      });

      for (const tagName of body.tags) {
        if (typeof tagName !== 'string' || !tagName.trim()) continue;
        const normalizedTag = tagName.trim().toLowerCase();
        const tag = await prisma.tag.upsert({
          where: { name: normalizedTag },
          create: { name: normalizedTag },
          update: {},
        });
        await prisma.knowledgeTag.create({
          data: { knowledgeId: id, tagId: tag.id },
        });
      }
    }

    const updated = await prisma.knowledge.update({
      where: { id },
      data: updateData,
      include: {
        knowledgeTags: { include: { tag: true } },
      },
    });

    return successResponse({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      content: updated.content,
      tags: updated.knowledgeTags.map((kt) => kt.tag.name),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }, '更新成功');
  } catch (err) {
    console.error('Update knowledge error:', err);
    if ((err as { code?: string }).code === 'P2002') {
      return errorResponse('知识名称已存在');
    }
    return errorResponse('更新失败');
  }
}