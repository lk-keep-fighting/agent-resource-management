import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { query } from '@/lib/db';
import type { Skill } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const skills = await query<Skill[]>(
      'SELECT id, name, description, license, compatibility, metadata, allowed_tools as allowedTools, file_size as fileSize, file_hash as fileHash, published_at as publishedAt, published_by as publishedBy, updated_at as updatedAt, download_count as downloadCount, status FROM skills WHERE published_by = ? ORDER BY published_at DESC',
      [user.id]
    );

    return successResponse(skills, '获取成功');
  } catch (err) {
    console.error('Get my skills error:', err);
    return errorResponse('获取失败');
  }
}