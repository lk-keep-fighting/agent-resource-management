import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { authenticate } from '@/lib/auth';
import prisma from '@/lib/db';

interface BatchVersionRequest {
  agentIds: string[];
  knowledgeId?: string;
}

function incrementVersion(version: string): string {
  const parts = version.split('.');
  const major = parseInt(parts[0] || '1', 10);
  const minor = parseInt(parts[1] || '0', 10);
  const patch = parseInt(parts[2] || '0', 10);
  return `${major}.${minor}.${patch + 1}`;
}

export async function PUT(
  request: NextRequest
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const body: BatchVersionRequest = await request.json();

    if (!body.agentIds || !Array.isArray(body.agentIds) || body.agentIds.length === 0) {
      return errorResponse('agentIds不能为空');
    }

    const agents = await prisma.agent.findMany({
      where: { id: { in: body.agentIds } },
    });

    if (agents.length !== body.agentIds.length) {
      const foundIds = agents.map((a) => a.id);
      const notFoundIds = body.agentIds.filter((id) => !foundIds.includes(id));
      return errorResponse(`Agent不存在: ${notFoundIds.join(', ')}`, 404);
    }

    const results = await Promise.all(
      agents.map(async (agent) => {
        const newVersion = incrementVersion(agent.version);
        const updated = await prisma.agent.update({
          where: { id: agent.id },
          data: { version: newVersion },
        });
        return {
          agentId: updated.id,
          agentName: updated.name,
          oldVersion: agent.version,
          newVersion: updated.version,
        };
      })
    );

    return successResponse({
      updatedAgents: results,
      knowledgeId: body.knowledgeId,
      message: `已成功更新 ${results.length} 个Agent版本`,
    }, '版本更新成功');
  } catch (err) {
    console.error('Batch update agent version error:', err);
    return errorResponse('更新失败');
  }
}