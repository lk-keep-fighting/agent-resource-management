import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';

interface BindKnowledgeRequest {
  knowledgeId: string;
  version?: string;
  retrievalConfig?: { topK?: number; similarityThreshold?: number };
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

    const { id: agentId } = await params;
    const body: BindKnowledgeRequest = await request.json();

    if (!body.knowledgeId) {
      return errorResponse('knowledgeId 不能为空');
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return errorResponse('Agent不存在', 404);
    }

    let version = body.version;

    if (!version) {
      const latestBinding = await prisma.agentKnowledgeBinding.findFirst({
        where: { agentId, knowledgeId: body.knowledgeId },
        orderBy: { createdAt: 'desc' },
      });

      if (latestBinding) {
        const parts = latestBinding.version.split('.');
        const patch = parseInt(parts[2] || '0', 10) + 1;
        version = `${parts[0] || '1'}.${parts[1] || '0'}.${patch}`;
      } else {
        version = '1.0.0';
      }
    } else {
      const existingBinding = await prisma.agentKnowledgeBinding.findUnique({
        where: {
          agentId_knowledgeId_version: {
            agentId,
            knowledgeId: body.knowledgeId,
            version,
          },
        },
      });

      if (existingBinding) {
        return errorResponse(`该知识版本 ${version} 已绑定到此Agent`);
      }
    }

    const binding = await prisma.agentKnowledgeBinding.create({
      data: {
        agentId,
        knowledgeId: body.knowledgeId,
        version,
        retrievalConfig: body.retrievalConfig as Record<string, unknown> || {},
      },
    });

    return successResponse({
      id: binding.id,
      agentId,
      knowledgeId: body.knowledgeId,
      version,
      retrievalConfig: binding.retrievalConfig,
    }, '绑定成功');
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

    const agentKnowledges = await prisma.agentKnowledgeBinding.findMany({
      where: {
        agentId,
        deletedAt: null,
      },
      include: { knowledge: true },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(
      agentKnowledges.map((ak) => ({
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
    const version = searchParams.get('version');

    if (!knowledgeId) {
      return errorResponse('knowledgeId不能为空');
    }

    if (version) {
      await prisma.agentKnowledgeBinding.updateMany({
        where: {
          agentId,
          knowledgeId,
          version,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    } else {
      await prisma.agentKnowledgeBinding.updateMany({
        where: {
          agentId,
          knowledgeId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }

    return successResponse(null, '解绑成功');
  } catch (err) {
    console.error('Unbind knowledge error:', err);
    return errorResponse('解绑失败');
  }
}
