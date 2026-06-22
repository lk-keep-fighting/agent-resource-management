import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import type { UpdateAgentRequest } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return errorResponse('Agent不存在', 404);
    }

    const [skillBindings, knowledgeBindings, feedbacks] = await Promise.all([
      prisma.agentSkillBinding.findMany({
        where: { agentId: id, deletedAt: null },
        include: { skill: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agentKnowledgeBinding.findMany({
        where: { agentId: id, deletedAt: null },
        include: { knowledge: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agentFeedback.findMany({
        where: { agentId: id },
        select: { rating: true, isHelpful: true },
      }),
    ]);

    const ratings = feedbacks.map((f) => f.rating).filter((r): r is number => typeof r === 'number');
    const avgRating = ratings.length === 0
      ? null
      : Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    const helpfulCount = feedbacks.filter((f) => f.isHelpful === true).length;
    const unhelpfulCount = feedbacks.filter((f) => f.isHelpful === false).length;

    return successResponse({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      prompt: agent.prompt,
      avatar: agent.avatar ?? undefined,
      version: agent.version,
      status: agent.status,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
      createdBy: agent.createdBy,
      feedbackSummary: {
        total: feedbacks.length,
        avgRating,
        helpfulCount,
        unhelpfulCount,
      },
      skills: skillBindings.map((as) => ({
        id: as.id,
        skillId: as.skillId,
        version: as.version,
        skill: {
          id: as.skill.id,
          name: as.skill.name,
          description: as.skill.description,
          allowedTools: as.skill.allowedTools as string[] | undefined,
        },
        config: as.config as Record<string, unknown> | undefined,
      })),
      knowledges: knowledgeBindings.map((ak) => ({
        id: ak.id,
        knowledgeId: ak.knowledgeId,
        version: ak.version,
        knowledge: {
          id: ak.knowledge.id,
          name: ak.knowledge.name,
          description: ak.knowledge.description,
        },
        retrievalConfig: ak.retrievalConfig as {
          topK?: number;
          similarityThreshold?: number;
        } | undefined,
      })),
    }, '获取成功');
  } catch (err) {
    console.error('Get agent error:', err);
    return errorResponse('获取失败');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const { id } = await params;
    const body: UpdateAgentRequest = await request.json();

    const existing = await prisma.agent.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Agent不存在', 404);
    }

    const agent = await prisma.agent.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.prompt !== undefined && { prompt: body.prompt }),
        ...(body.avatar !== undefined && { avatar: body.avatar }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.version !== undefined && { version: body.version }),
      },
    });

    return successResponse({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      prompt: agent.prompt,
      avatar: agent.avatar ?? undefined,
      status: agent.status,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
      createdBy: agent.createdBy,
    }, '更新成功');
  } catch (err) {
    console.error('Update agent error:', err);
    if ((err as { code?: string }).code === 'P2002') {
      return errorResponse('Agent名称已存在');
    }
    return errorResponse('更新失败');
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

    const existing = await prisma.agent.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Agent不存在', 404);
    }

    await prisma.agent.delete({ where: { id } });

    return successResponse(null, '删除成功');
  } catch (err) {
    console.error('Delete agent error:', err);
    return errorResponse('删除失败');
  }
}