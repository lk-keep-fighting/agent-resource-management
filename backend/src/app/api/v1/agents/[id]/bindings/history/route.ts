import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';

export async function GET(
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
    const componentType = searchParams.get('type');

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return errorResponse('Agent不存在', 404);
    }

    const result: {
      skillBindings: Array<{
        id: string;
        skillId: string;
        skillName: string;
        version: string;
        config: Record<string, unknown> | null;
        createdAt: string;
        deletedAt: string | null;
      }>;
      knowledgeBindings: Array<{
        id: string;
        knowledgeId: string;
        knowledgeName: string;
        version: string;
        retrievalConfig: Record<string, unknown> | null;
        createdAt: string;
        deletedAt: string | null;
      }>;
    } = {
      skillBindings: [],
      knowledgeBindings: [],
    };

    if (!componentType || componentType === 'skill') {
      const skillBindings = await prisma.agentSkillBinding.findMany({
        where: { agentId },
        include: { skill: true },
        orderBy: { createdAt: 'desc' },
      });

      result.skillBindings = skillBindings.map((sb) => ({
        id: sb.id,
        skillId: sb.skillId,
        skillName: sb.skill.name,
        version: sb.version,
        config: sb.config as Record<string, unknown> | null,
        createdAt: sb.createdAt.toISOString(),
        deletedAt: sb.deletedAt?.toISOString() || null,
      }));
    }

    if (!componentType || componentType === 'knowledge') {
      const knowledgeBindings = await prisma.agentKnowledgeBinding.findMany({
        where: { agentId },
        include: { knowledge: true },
        orderBy: { createdAt: 'desc' },
      });

      result.knowledgeBindings = knowledgeBindings.map((kb) => ({
        id: kb.id,
        knowledgeId: kb.knowledgeId,
        knowledgeName: kb.knowledge.name,
        version: kb.version,
        retrievalConfig: kb.retrievalConfig as Record<string, unknown> | null,
        createdAt: kb.createdAt.toISOString(),
        deletedAt: kb.deletedAt?.toISOString() || null,
      }));
    }

    return successResponse(result, '获取成功');
  } catch (err) {
    console.error('Get binding history error:', err);
    return errorResponse('获取失败');
  }
}
