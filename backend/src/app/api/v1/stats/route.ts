import { successResponse } from '@/lib/api-response';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [agentsCount, skillsCount, knowledgesCount, downloadCount] = await Promise.all([
      prisma.agent.count(),
      prisma.skill.count({ where: { status: 'active' } }),
      prisma.knowledge.count(),
      prisma.skill.aggregate({ _sum: { downloadCount: true } }),
    ]);

    return successResponse({
      agents: agentsCount,
      skills: skillsCount,
      knowledges: knowledgesCount,
      downloads: downloadCount._sum.downloadCount || 0,
    });
  } catch (err) {
    console.error('Get stats error:', err);
    return successResponse({
      agents: 0,
      skills: 0,
      knowledges: 0,
      downloads: 0,
    });
  }
}