import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import type { Skill, SkillListResponse } from '@/lib/types';

const skillColumns = 'id, name, description, license, compatibility, metadata, allowed_tools as allowedTools, file_size as fileSize, file_hash as fileHash, published_at as publishedAt, published_by as publishedBy, updated_at as updatedAt, download_count as downloadCount, status';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

function hashFile(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const pageNum = parseInt(searchParams.get('page') || '1', 10);
    const offset = (pageNum - 1) * pageSize;

    let sql = `SELECT ${skillColumns} FROM skills WHERE status = ?`;
    let countSql = 'SELECT COUNT(*) as total FROM skills WHERE status = ?';
    const params: (string | number)[] = ['active'];

    if (keyword) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      countSql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const skills = await query<Skill[]>(sql, params);

    const countParams = keyword ? ['active', `%${keyword}%`, `%${keyword}%`] : ['active'];
    const countResult = await query<{ total: number }[]>(countSql, countParams);
    const total = countResult[0]?.total || 0;

    const response: SkillListResponse = {
      skills,
      total,
      page: pageNum,
      pageSize,
    };

    return successResponse(response, '获取成功');
  } catch (err) {
    console.error('Get skills error:', err);
    return errorResponse('获取失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponse('请上传 Skill ZIP 文件');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = hashFile(buffer);
    const fileSize = buffer.length;

    const tempDir = path.join(DATA_DIR, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempFilePath = path.join(tempDir, `${uuidv4()}.zip`);
    await fs.writeFile(tempFilePath, buffer);

    const { execSync } = require('child_process');
    const extractDir = path.join(tempDir, uuidv4());
    execSync(`unzip -o ${tempFilePath} -d ${extractDir}`);

    const skillDir = path.join(extractDir, file.name.replace('.zip', ''));
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    let skillMetadata: Partial<Skill> = {};
    try {
      const skillMdContent = await fs.readFile(skillMdPath, 'utf-8');
      const frontmatterMatch = skillMdContent.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const nameMatch = frontmatter.match(/name:\s*(.+)/);
        const descMatch = frontmatter.match(/description:\s*(.+)/);
        const licenseMatch = frontmatter.match(/license:\s*(.+)/);
        const compatMatch = frontmatter.match(/compatibility:\s*(.+)/);
        const toolsMatch = frontmatter.match(/allowed-tools:\s*(.+)/);

        if (nameMatch) skillMetadata.name = nameMatch[1].trim();
        if (descMatch) skillMetadata.description = descMatch[1].trim();
        if (licenseMatch) skillMetadata.license = licenseMatch[1].trim();
        if (compatMatch) skillMetadata.compatibility = compatMatch[1].trim();
        if (toolsMatch) {
          skillMetadata.allowedTools = toolsMatch[1].split(',').map((t: string) => t.trim());
        }
      }
    } catch {
      await fs.rm(extractDir, { recursive: true, force: true });
      await fs.rm(tempFilePath);
      return errorResponse('无效的 Skill 格式：缺少 SKILL.md 文件');
    }

    const skillName = skillMetadata.name || file.name.replace('.zip', '');
    const destDir = path.join(DATA_DIR, 'skills', skillName);
    await fs.mkdir(destDir, { recursive: true });
    await fs.cp(skillDir, destDir, { recursive: true });

    await fs.rm(extractDir, { recursive: true, force: true });
    await fs.rm(tempFilePath);

    const zipDestPath = path.join(DATA_DIR, 'skills', `${skillName}.zip`);
    await fs.writeFile(zipDestPath, buffer);

    const existingSkills = await query<Skill[]>(
      `SELECT ${skillColumns} FROM skills WHERE name = ?`,
      [skillName]
    );

    if (existingSkills.length > 0) {
      await query(
        `UPDATE skills SET description = ?, license = ?, compatibility = ?, 
         metadata = ?, allowed_tools = ?, file_size = ?, file_hash = ?,
         updated_at = NOW(), published_at = COALESCE(published_at, NOW()), status = 'active'
         WHERE name = ?`,
        [
          skillMetadata.description || '',
          skillMetadata.license || null,
          skillMetadata.compatibility || null,
          JSON.stringify(skillMetadata.metadata || {}),
          JSON.stringify(skillMetadata.allowedTools || []),
          fileSize,
          fileHash,
          skillName,
        ]
      );
    } else {
      const id = uuidv4();
      await query(
        `INSERT INTO skills (id, name, description, license, compatibility, metadata, allowed_tools,
         file_size, file_hash, published_at, published_by, status, download_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'active', 0)`,
        [
          id,
          skillName,
          skillMetadata.description || '',
          skillMetadata.license || null,
          skillMetadata.compatibility || null,
          JSON.stringify(skillMetadata.metadata || {}),
          JSON.stringify(skillMetadata.allowedTools || []),
          fileSize,
          fileHash,
          user.id,
        ]
      );
    }

    const skills = await query<Skill[]>(
      `SELECT ${skillColumns} FROM skills WHERE name = ?`,
      [skillName]
    );

    return successResponse(skills[0], '上传成功');
  } catch (err) {
    console.error('Upload skill error:', err);
    return errorResponse('上传失败');
  }
}