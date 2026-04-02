import { successResponse } from '@/lib/api-response';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { skillTags: true },
        },
      },
    });

    const tagsFormatted = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      skillCount: tag._count.skillTags,
    }));

    return successResponse(tagsFormatted, '获取成功');
  } catch (err) {
    console.error('Get tags error:', err);
    return successResponse([], '获取成功');
  }
}