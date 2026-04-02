import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import type { SkillListResponse } from '@/lib/types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

function hashFile(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const pageNum = parseInt(searchParams.get('page') || '1', 10);
    const offset = (pageNum - 1) * pageSize;

    const where = {
      status: 'active' as const,
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
      }),
      prisma.skill.count({ where }),
    ]);

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

    const response: SkillListResponse = {
      skills: skillsFormatted,
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

    let skillMetadata: {
      name?: string;
      description?: string;
      license?: string;
      compatibility?: string;
      allowedTools?: string[];
      metadata?: Record<string, string>;
    } = {};
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

    const existingSkill = await prisma.skill.findUnique({
      where: { name: skillName },
    });

    let skill;
    if (existingSkill) {
      skill = await prisma.skill.update({
        where: { name: skillName },
        data: {
          description: skillMetadata.description || '',
          license: skillMetadata.license,
          compatibility: skillMetadata.compatibility,
          metadata: skillMetadata.metadata || {},
          allowedTools: skillMetadata.allowedTools || [],
          fileSize: fileSize,
          fileHash: fileHash,
          publishedAt: existingSkill.publishedAt || new Date(),
          status: 'active',
        },
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
    } else {
      const id = uuidv4();
      skill = await prisma.skill.create({
        data: {
          id,
          name: skillName,
          description: skillMetadata.description || '',
          license: skillMetadata.license,
          compatibility: skillMetadata.compatibility,
          metadata: skillMetadata.metadata || {},
          allowedTools: skillMetadata.allowedTools || [],
          fileSize: fileSize,
          fileHash: fileHash,
          publishedAt: new Date(),
          publishedBy: user.id,
          status: 'active',
          downloadCount: 0,
        },
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
    }

    const skillFormatted = {
      ...skill,
      publishedAt: skill.publishedAt.toISOString(),
      updatedAt: skill.updatedAt.toISOString(),
      license: skill.license ?? undefined,
      compatibility: skill.compatibility ?? undefined,
      fileSize: Number(skill.fileSize),
      metadata: skill.metadata as Record<string, string> | undefined,
      allowedTools: skill.allowedTools as string[] | undefined,
    };

    return successResponse(skillFormatted, '上传成功');
  } catch (err) {
    console.error('Upload skill error:', err);
    return errorResponse('上传失败');
  }
}
