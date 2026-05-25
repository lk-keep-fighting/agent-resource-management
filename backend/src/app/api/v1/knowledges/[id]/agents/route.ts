import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: knowledgeId } = await params;

    const agentKnowledges = await prisma.agentKnowledgeBinding.findMany({
      where: { knowledgeId, deletedAt: null },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            version: true,
            description: true,
          },
        },
      },
    });

    const agents = agentKnowledges.map((ak) => ({
      agentId: ak.agent.id,
      agentName: ak.agent.name,
      agentVersion: ak.agent.version,
      agentDescription: ak.agent.description,
      retrievalConfig: ak.retrievalConfig as {
        topK?: number;
        similarityThreshold?: number;
      } | undefined,
      bindingVersion: ak.version,
    }));

    return successResponse(agents, '获取成功');
  } catch (err) {
    console.error('Get knowledge agents error:', err);
    return errorResponse('获取失败');
  }
}