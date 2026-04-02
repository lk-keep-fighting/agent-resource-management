import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { query } from '@/lib/db';
import type { Skill } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    const skills = await query<any[]>(
      `SELECT s.id, s.name, s.description, s.license, s.compatibility, s.metadata, 
       s.allowed_tools as allowedTools, s.file_size as fileSize, s.file_hash as fileHash, 
       s.published_at as publishedAt, s.published_by as publishedBy, s.updated_at as updatedAt, 
       s.download_count as downloadCount, s.status,
       u.id as publisherId, u.name as publisherName
       FROM skills s
       LEFT JOIN users u ON s.published_by = u.id
       WHERE s.name = ? AND s.status = ?`,
      [name, 'active']
    );

    if (skills.length === 0) {
      return errorResponse('Skill 不存在', 404);
    }

    const skill = skills[0];
    const response = {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      license: skill.license,
      compatibility: skill.compatibility,
      metadata: skill.metadata,
      allowedTools: skill.allowedTools,
      fileSize: skill.fileSize,
      fileHash: skill.fileHash,
      publishedAt: skill.publishedAt,
      publishedBy: { id: skill.publisherId, name: skill.publisherName },
      updatedAt: skill.updatedAt,
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

    const skills = await query<Skill[]>(
      'SELECT id, name, description, license, compatibility, metadata, allowed_tools, file_size as fileSize, file_hash as fileHash, published_at as publishedAt, published_by as publishedBy, updated_at as updatedAt, download_count as downloadCount, status FROM skills WHERE name = ? AND status = ?',
      [name, 'active']
    );

    if (skills.length === 0) {
      return errorResponse('Skill 不存在', 404);
    }

    const skill = skills[0];
    if (skill.publishedBy !== user.id) {
      return errorResponse('无权限删除此 Skill', 403);
    }

    await query(
      'UPDATE skills SET status = ? WHERE id = ?',
      ['deleted', skill.id]
    );

    return successResponse(null, '删除成功');
  } catch (err) {
    console.error('Delete skill error:', err);
    return errorResponse('删除失败');
  }
}