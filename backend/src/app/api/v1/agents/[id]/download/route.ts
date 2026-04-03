import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import { fetchKnowledgeById } from '@/lib/knowledge';
import path from 'path';
import fs from 'fs/promises';
import { mkdtempSync, rmSync } from 'fs';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

interface SkillInfo {
  skillId: string;
  skill: {
    id: string;
    name: string;
    description: string;
    allowedTools?: string[];
  };
  config?: Record<string, unknown>;
}

interface KnowledgeInfo {
  knowledgeId: string;
  title: string;
  filename: string;
  retrievalConfig?: {
    topK?: number;
    similarityThreshold?: number;
  };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        agentSkills: {
          include: { skill: true },
        },
        agentKnowledges: true,
      },
    });

    if (!agent) {
      return errorResponse('Agent不存在', 404);
    }

    const tempDir = mkdtempSync(path.join('/tmp', 'agent-download-'));
    const extractDir = path.join(tempDir, 'agent-content');
    const skillsDir = path.join(extractDir, 'skills');
    const knowledgesDir = path.join(extractDir, 'knowledges');

    await fs.mkdir(skillsDir, { recursive: true });
    await fs.mkdir(knowledgesDir, { recursive: true });

    const skillsInfo: SkillInfo[] = [];
    for (const as of agent.agentSkills) {
      const skillZipPath = path.join(DATA_DIR, 'skills', `${as.skill.name}.zip`);
      const skillExtractDir = path.join(skillsDir, as.skill.name);

      try {
        await fs.access(skillZipPath);
        await fs.mkdir(skillExtractDir, { recursive: true });
        const { execSync } = await import('child_process');
        execSync(`unzip -q "${skillZipPath}" -d "${skillExtractDir}"`, { stdio: 'pipe' });

        skillsInfo.push({
          skillId: as.skill.id,
          skill: {
            id: as.skill.id,
            name: as.skill.name,
            description: as.skill.description,
            allowedTools: as.skill.allowedTools as string[] | undefined,
          },
          config: as.config as Record<string, unknown> | undefined,
        });
      } catch {
        console.error(`Failed to extract skill: ${as.skill.name}`);
      }
    }

    const knowledgesInfo: KnowledgeInfo[] = [];
    for (const ak of agent.agentKnowledges) {
      const knowledge = await fetchKnowledgeById(ak.knowledgeId);
      const title = knowledge?.title || knowledge?.name || ak.knowledgeId;
      const filename = `${sanitizeFilename(title)}.md`;
      const filePath = path.join(knowledgesDir, filename);

      if (knowledge?.content) {
        await fs.writeFile(filePath, knowledge.content, 'utf-8');
      } else {
        await fs.writeFile(filePath, `# ${title}\n\n知识内容获取失败`, 'utf-8');
      }

      knowledgesInfo.push({
        knowledgeId: ak.knowledgeId,
        title,
        filename,
        retrievalConfig: ak.retrievalConfig as { topK?: number; similarityThreshold?: number } | undefined,
      });
    }

    const agentsMdContent = `---
name: ${agent.name}
version: ${agent.version}
description: ${agent.description}
skills:
${skillsInfo.map(s => `  - name: ${s.skill.name}`).join('\n')}
knowledges:
${knowledgesInfo.map(k => `  - ${k.filename}`).join('\n')}
---

# System Prompt
${agent.prompt}
`;

    await fs.writeFile(path.join(extractDir, 'AGENT.md'), agentsMdContent, 'utf-8');

    const zipFileName = `agent-${Date.now()}.zip`;
    const zipPath = path.join(tempDir, zipFileName);
    const { execSync } = await import('child_process');
    execSync(`cd "${tempDir}" && zip -q -r "${zipFileName}" "agent-content"`, { stdio: 'pipe' });

    const fileBuffer = await fs.readFile(zipPath);

    rmSync(tempDir, { recursive: true, force: true });

    const encodedFilename = encodeURIComponent(agent.name);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodedFilename}.zip"`,
        'X-Version': agent.version,
      },
    });
  } catch (err) {
    console.error('Download agent error:', err);
    return errorResponse('下载失败');
  }
}