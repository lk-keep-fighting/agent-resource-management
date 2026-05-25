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
        skillBindings: {
          where: { deletedAt: null },
          include: { skill: true },
        },
        knowledgeBindings: {
          where: { deletedAt: null },
        },
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
      skills: agent.skillBindings.map((sb) => ({
        id: sb.skill.id,
        name: sb.skill.name,
        description: sb.skill.description,
        allowedTools: sb.skill.allowedTools as string[] | undefined,
        config: sb.config as Record<string, unknown> || {},
        version: sb.version,
      })),
      knowledges: agent.knowledgeBindings.map((kb) => ({
        id: kb.knowledgeId,
        retrievalConfig: kb.retrievalConfig as {
          topK?: number;
          similarityThreshold?: number;
        } | undefined,
        version: kb.version,
      })),
    };

    return successResponse(config, '获取成功');
  } catch (err) {
    console.error('Get agent config error:', err);
    return errorResponse('获取配置失败');
  }
}