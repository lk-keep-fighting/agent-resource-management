import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

interface BindSkillRequest {
  skillId: string;
  version?: string;
  config?: Record<string, unknown>;
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
    const body: BindSkillRequest = await request.json();

    if (!body.skillId) {
      return errorResponse('skillId 不能为空');
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return errorResponse('Agent不存在', 404);
    }

    const skill = await prisma.skill.findUnique({ where: { id: body.skillId } });
    if (!skill) {
      return errorResponse('Skill不存在', 404);
    }

    let version = body.version;

    if (!version) {
      const latestBinding = await prisma.agentSkillBinding.findFirst({
        where: { agentId, skillId: body.skillId },
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
      const existingBinding = await prisma.agentSkillBinding.findUnique({
        where: {
          agentId_skillId_version: {
            agentId,
            skillId: body.skillId,
            version,
          },
        },
      });

      if (existingBinding) {
        return errorResponse(`该Skill版本 ${version} 已绑定到此Agent`);
      }
    }

    const binding = await prisma.agentSkillBinding.create({
      data: {
        agentId,
        skillId: body.skillId,
        version,
        config: body.config as Prisma.InputJsonValue || {},
      },
    });

    return successResponse({
      id: binding.id,
      agentId,
      skillId: body.skillId,
      version,
      config: binding.config,
    }, '绑定成功');
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

    const agentSkills = await prisma.agentSkillBinding.findMany({
      where: {
        agentId,
        deletedAt: null,
      },
      include: { skill: true },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(
      agentSkills.map((as) => ({
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
        createdAt: as.createdAt.toISOString(),
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
    const version = searchParams.get('version');

    if (!skillId) {
      return errorResponse('skillId不能为空');
    }

    if (version) {
      await prisma.agentSkillBinding.updateMany({
        where: {
          agentId,
          skillId,
          version,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    } else {
      await prisma.agentSkillBinding.updateMany({
        where: {
          agentId,
          skillId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }

    return successResponse(null, '解绑成功');
  } catch (err) {
    console.error('Unbind skill error:', err);
    return errorResponse('解绑失败');
  }
}
