import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    if (user.role !== 'ADMIN') {
      return errorResponse('无权限', 403);
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const pageNum = parseInt(searchParams.get('page') || '1', 10);
    const offset = (pageNum - 1) * pageSize;

    const where: Prisma.SkillWhereInput = {
      ...(keyword ? {
        OR: [
          { name: { contains: keyword } },
          { description: { contains: keyword } },
        ],
      } : {}),
    };

    const [skills, total] = await Promise.all([
      prisma.skill.findMany({
        where,
        skip: offset,
        take: pageSize,
        orderBy: { publishedAt: 'desc' },
        include: {
          publisher: {
            select: { name: true, email: true },
          },
          skillTags: {
            include: { tag: true },
          },
        },
      }),
      prisma.skill.count({ where }),
    ]);

    const skillsFormatted = skills.map((skill) => ({
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
      publishedBy: skill.publishedBy,
      publisherName: skill.publisher.name,
      publisherEmail: skill.publisher.email,
      updatedAt: skill.updatedAt.toISOString(),
      downloadCount: skill.downloadCount,
      status: skill.status,
      tags: skill.skillTags.map((st) => st.tag.name),
    }));

    return successResponse({
      skills: skillsFormatted,
      total,
      page: pageNum,
      pageSize,
    }, '获取成功');
  } catch (err) {
    console.error('Admin get skills error:', err);
    return errorResponse('获取失败');
  }
}