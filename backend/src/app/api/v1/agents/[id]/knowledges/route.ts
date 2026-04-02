import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import type { BindKnowledgeRequest } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const { id: agentId } = await params;
    const body: BindKnowledgeRequest = await request.json();

    if (!body.knowledgeId) {
      return errorResponse('knowledgeId不能为空');
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return errorResponse('Agent不存在', 404);
    }

    const existing = await prisma.agentKnowledge.findUnique({
      where: { agentId_knowledgeId: { agentId, knowledgeId: body.knowledgeId } },
    });

    if (existing) {
      return errorResponse('该知识已绑定到此Agent');
    }

    await prisma.agentKnowledge.create({
      data: {
        agentId,
        knowledgeId: body.knowledgeId,
        retrievalConfig: body.retrievalConfig || {},
      },
    });

    return successResponse({ agentId, knowledgeId: body.knowledgeId }, '绑定成功');
  } catch (err) {
    console.error('Bind knowledge error:', err);
    return errorResponse('绑定失败');
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    const agentKnowledges = await prisma.agentKnowledge.findMany({
      where: { agentId },
    });

    return successResponse(
      agentKnowledges.map((ak) => ({
        knowledgeId: ak.knowledgeId,
        retrievalConfig: ak.retrievalConfig as {
          topK?: number;
          similarityThreshold?: number;
        } | undefined,
        createdAt: ak.createdAt.toISOString(),
      })),
      '获取成功'
    );
  } catch (err) {
    console.error('Get agent knowledges error:', err);
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

    const { id: agentId } = await params;
    const { searchParams } = new URL(request.url);
    const knowledgeId = searchParams.get('knowledgeId');

    if (!knowledgeId) {
      return errorResponse('knowledgeId不能为空');
    }

    await prisma.agentKnowledge.delete({
      where: { agentId_knowledgeId: { agentId, knowledgeId } },
    });

    return successResponse(null, '解绑成功');
  } catch (err) {
    console.error('Unbind knowledge error:', err);
    return errorResponse('解绑失败');
  }
}