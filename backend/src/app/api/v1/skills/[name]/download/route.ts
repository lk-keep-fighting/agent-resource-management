import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import path from 'path';
import fs from 'fs/promises';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

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
    });

    if (!skill) {
      return errorResponse('Skill 不存在', 404);
    }

    const filePath = path.join(DATA_DIR, 'skills', `${name}.zip`);

    try {
      await fs.access(filePath);
    } catch {
      return errorResponse('Skill 文件不存在', 404);
    }

    await prisma.skill.update({
      where: { id: skill.id },
      data: { downloadCount: { increment: 1 } },
    });

    const fileBuffer = await fs.readFile(filePath);
    const fileHash = Buffer.from(await crypto.subtle.digest('SHA-256', fileBuffer)).toString('hex');

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${name}.zip"`,
        'X-File-Hash': fileHash,
      },
    });
  } catch (err) {
    console.error('Download skill error:', err);
    return errorResponse('下载失败');
  }
}

const crypto = require('crypto');
