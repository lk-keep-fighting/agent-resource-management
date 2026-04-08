import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

export const dynamic = 'force-dynamic';

const DATA_DIR = process.env.DATA_DIR 
  ? (path.isAbsolute(process.env.DATA_DIR) ? process.env.DATA_DIR : path.join(process.cwd(), process.env.DATA_DIR))
  : path.join(process.cwd(), 'data');

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    if (user.role !== 'ADMIN') {
      return errorResponse('无权限', 403);
    }

    const { name } = await params;

    const skill = await prisma.skill.findUnique({
      where: { name },
    });

    if (!skill) {
      return errorResponse('Skill 不存在', 404);
    }

    await prisma.skill.delete({
      where: { name },
    });

    try {
      const skillDir = path.join(DATA_DIR, 'skills', name);
      const zipPath = path.join(DATA_DIR, 'skills', `${name}.zip`);
      await fs.rm(skillDir, { recursive: true, force: true });
      await fs.rm(zipPath, { force: true });
    } catch {
    }

    return successResponse(null, '删除成功');
  } catch (err) {
    console.error('Admin delete skill error:', err);
    return errorResponse('删除失败');
  }
}