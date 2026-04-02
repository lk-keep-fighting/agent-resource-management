import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import type { Skill } from '@/lib/types';
import path from 'path';
import fs from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    const skills = await query<Skill[]>(
      'SELECT id, name, description, license, compatibility, metadata, allowed_tools as allowedTools, file_size as fileSize, file_hash as fileHash, published_at as publishedAt, published_by as publishedBy, updated_at as updatedAt, download_count as downloadCount, status FROM skills WHERE name = ? AND status = ?',
      [name, 'active']
    );

    if (skills.length === 0) {
      return errorResponse('Skill 不存在', 404);
    }

    const skill = skills[0];
    const filePath = path.join(process.cwd(), 'data', 'skills', `${name}.zip`);

    try {
      await fs.access(filePath);
    } catch {
      return errorResponse('Skill 文件不存在', 404);
    }

    await query(
      'UPDATE skills SET download_count = download_count + 1 WHERE id = ?',
      [skill.id]
    );

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