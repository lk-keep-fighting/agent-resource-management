import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    const skill = await prisma.skill.findFirst({
      where: {
        name,
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        description: true,
        license: true,
        compatibility: true,
        metadata: true,
        allowedTools: true,
        fileSize: true,
        fileHash: true,
        publishedAt: true,
        publishedBy: true,
        updatedAt: true,
        downloadCount: true,
        status: true,
        publisher: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!skill) {
      return errorResponse('Skill 不存在', 404);
    }

    const response = {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      license: skill.license ?? undefined,
      compatibility: skill.compatibility ?? undefined,
      metadata: skill.metadata as Record<string, string> | undefined,
      allowedTools: skill.allowedTools as string[] | undefined,
      fileSize: Number(skill.fileSize),
      fileHash: skill.fileHash,
      publishedAt: skill.publishedAt.toISOString(),
      publishedBy: { id: skill.publisher.id, name: skill.publisher.name },
      updatedAt: skill.updatedAt.toISOString(),
      downloadCount: skill.downloadCount,
      status: skill.status,
    };

    return successResponse(response, '获取成功');
  } catch (err) {
    console.error('Get skill error:', err);
    return errorResponse('获取失败');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const { name } = await params;

    const skill = await prisma.skill.findFirst({
      where: {
        name,
        status: 'active',
      },
    });

    if (!skill) {
      return errorResponse('Skill 不存在', 404);
    }

    if (skill.publishedBy !== user.id) {
      return errorResponse('无权限删除此 Skill', 403);
    }

    await prisma.skill.update({
      where: { id: skill.id },
      data: { status: 'deleted' },
    });

    return successResponse(null, '删除成功');
  } catch (err) {
    console.error('Delete skill error:', err);
    return errorResponse('删除失败');
  }
}
