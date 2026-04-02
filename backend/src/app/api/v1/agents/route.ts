import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { AgentListResponse, CreateAgentRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const status = searchParams.get('status') as 'active' | 'draft' | null;
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const pageNum = parseInt(searchParams.get('page') || '1', 10);
    const offset = (pageNum - 1) * pageSize;

    const where: Prisma.AgentWhereInput = {
      ...(keyword ? {
        OR: [
          { name: { contains: keyword } },
          { description: { contains: keyword } },
        ],
      } : {}),
      ...(status ? { status } : {}),
    };

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip: offset,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          agentSkills: true,
          agentKnowledges: true,
        },
      }),
      prisma.agent.count({ where }),
    ]);

    const response: AgentListResponse = {
      agents: agents.map((agent) => ({
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
        skillsCount: agent.agentSkills.length,
        knowledgesCount: agent.agentKnowledges.length,
      })),
      total,
      page: pageNum,
      pageSize,
    };

    return successResponse(response, '获取成功');
  } catch (err) {
    console.error('Get agents error:', err);
    return errorResponse('获取失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/v1/agents called');
    const authHeader = request.headers.get('Authorization');
    console.log('Auth header:', authHeader);
    const user = await authenticate(request);
    console.log('Authenticated user:', user);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const body: CreateAgentRequest = await request.json();

    if (!body.name || !body.prompt) {
      return errorResponse('名称和prompt不能为空');
    }

    const agent = await prisma.agent.create({
      data: {
        name: body.name,
        description: body.description || '',
        prompt: body.prompt,
        avatar: body.avatar,
        status: body.status || 'active',
        createdBy: user.id,
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
    }, '创建成功');
  } catch (err) {
    console.error('Create agent error:', err);
    if ((err as { code?: string }).code === 'P2002') {
      return errorResponse('Agent名称已存在');
    }
    return errorResponse('创建失败');
  }
}