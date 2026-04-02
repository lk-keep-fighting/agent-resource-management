import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { BindSkillRequest } from '@/lib/types';

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
    const body: BindSkillRequest = await request.json();

    if (!body.skillId) {
      return errorResponse('skillId不能为空');
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return errorResponse('Agent不存在', 404);
    }

    const skill = await prisma.skill.findUnique({ where: { id: body.skillId } });
    if (!skill) {
      return errorResponse('Skill不存在', 404);
    }

    const existing = await prisma.agentSkill.findUnique({
      where: { agentId_skillId: { agentId, skillId: body.skillId } },
    });

    if (existing) {
      return errorResponse('该Skill已绑定到此Agent');
    }

    await prisma.agentSkill.create({
      data: {
        agentId,
        skillId: body.skillId,
        config: body.config as Prisma.InputJsonValue || {},
      },
    });

    return successResponse({ agentId, skillId: body.skillId }, '绑定成功');
  } catch (err) {
    console.error('Bind skill error:', err);
    return errorResponse('绑定失败');
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    const agentSkills = await prisma.agentSkill.findMany({
      where: { agentId },
      include: { skill: true },
    });

    return successResponse(
      agentSkills.map((as) => ({
        skillId: as.skillId,
        skill: {
          id: as.skill.id,
          name: as.skill.name,
          description: as.skill.description,
          allowedTools: as.skill.allowedTools as string[] | undefined,
        },
        config: as.config as Record<string, unknown> | undefined,
      })),
      '获取成功'
    );
  } catch (err) {
    console.error('Get agent skills error:', err);
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
    const skillId = searchParams.get('skillId');

    if (!skillId) {
      return errorResponse('skillId不能为空');
    }

    await prisma.agentSkill.delete({
      where: { agentId_skillId: { agentId, skillId } },
    });

    return successResponse(null, '解绑成功');
  } catch (err) {
    console.error('Unbind skill error:', err);
    return errorResponse('解绑失败');
  }
}