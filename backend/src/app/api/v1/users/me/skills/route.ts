import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const skills = await prisma.skill.findMany({
      where: {
        publishedBy: user.id,
      },
      orderBy: { publishedAt: 'desc' },
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
      },
    });

    const skillsFormatted = skills.map((skill) => ({
      ...skill,
      publishedAt: skill.publishedAt.toISOString(),
      updatedAt: skill.updatedAt.toISOString(),
      license: skill.license ?? undefined,
      compatibility: skill.compatibility ?? undefined,
      fileSize: Number(skill.fileSize),
      metadata: skill.metadata as Record<string, string> | undefined,
      allowedTools: skill.allowedTools as string[] | undefined,
    }));

    return successResponse(skillsFormatted, '获取成功');
  } catch (err) {
    console.error('Get my skills error:', err);
    return errorResponse('获取失败');
  }
}
