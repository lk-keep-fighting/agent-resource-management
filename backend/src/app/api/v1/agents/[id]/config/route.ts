import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import type { AgentConfig } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        agentSkills: {
          include: { skill: true },
        },
        agentKnowledges: true,
      },
    });

    if (!agent) {
      return errorResponse('Agent不存在', 404);
    }

    if (agent.status !== 'active') {
      return errorResponse('Agent未启用', 400);
    }

    const config: AgentConfig = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      prompt: agent.prompt,
      skills: agent.agentSkills.map((as) => ({
        id: as.skill.id,
        name: as.skill.name,
        description: as.skill.description,
        allowedTools: as.skill.allowedTools as string[] | undefined,
        config: as.config as Record<string, unknown> || {},
      })),
      knowledges: agent.agentKnowledges.map((ak) => ({
        id: ak.knowledgeId,
        retrievalConfig: ak.retrievalConfig as {
          topK?: number;
          similarityThreshold?: number;
        } | undefined,
      })),
    };

    return successResponse(config, '获取成功');
  } catch (err) {
    console.error('Get agent config error:', err);
    return errorResponse('获取配置失败');
  }
}