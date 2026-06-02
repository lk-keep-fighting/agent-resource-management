import { readFileSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join, extname } from 'path';
import { mkdtempSync, rmSync } from 'fs';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    name?: string;
    description?: string;
    license?: string;
    compatibility?: string;
    allowedTools?: string[];
    metadata?: Record<string, string>;
  };
}

export function validateZip(filePath: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!existsSync(filePath)) {
    result.valid = false;
    result.errors.push(`文件不存在: ${filePath}`);
    return result;
  }

  if (extname(filePath).toLowerCase() !== '.zip') {
    result.valid = false;
    result.errors.push('文件必须是 ZIP 格式');
    return result;
  }

  const stats = statSync(filePath);
  if (stats.size === 0) {
    result.valid = false;
    result.errors.push('ZIP 文件为空');
    return result;
  }

  try {
    const tempDir = mkdtempSync('/tmp/skill-validate-');
    execSync(`unzip -o "${filePath}" -d "${tempDir}"`, { stdio: 'pipe' });

    const entries = execSync(`unzip -l "${filePath}"`, { encoding: 'utf-8' });
    const hasSkillMd = entries.includes('SKILL.md');

    if (!hasSkillMd) {
      result.valid = false;
      result.errors.push('ZIP 包内缺少 SKILL.md 文件');
    }

    const skillMdPath = join(tempDir, 'SKILL.md');
    if (existsSync(skillMdPath)) {
      const skillMdContent = readFileSync(skillMdPath, 'utf-8');
      const frontmatterMatch = skillMdContent.match(/^---\n([\s\S]*?)\n---/);

      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        result.metadata = {};

        const nameMatch = frontmatter.match(/name:\s*(.+)/);
        const descMatch = frontmatter.match(/description:\s*(.+)/);
        const licenseMatch = frontmatter.match(/license:\s*(.+)/);
        const compatMatch = frontmatter.match(/compatibility:\s*(.+)/);
        const toolsMatch = frontmatter.match(/allowed-tools:\s*(.+)/);
        const metaMatch = frontmatter.match(/metadata:\s*([\s\S]*?)(?=\n\w|$)/);

        if (nameMatch) {
          const name = nameMatch[1].trim();
          if (name.length < 1 || name.length > 64) {
            result.valid = false;
            result.errors.push('name 长度必须在 1-64 字符之间');
          }
          if (!/^[a-z0-9-]+$/.test(name)) {
            result.valid = false;
            result.errors.push('name 只能包含小写字母、数字和连字符');
          }
          result.metadata.name = name;
        } else {
          result.valid = false;
          result.errors.push('缺少 name 字段');
        }

        if (descMatch) {
          const desc = descMatch[1].trim();
          if (desc.length < 1 || desc.length > 1024) {
            result.valid = false;
            result.errors.push('description 长度必须在 1-1024 字符之间');
          }
          result.metadata.description = desc;
        } else {
          result.valid = false;
          result.errors.push('缺少 description 字段');
        }

        if (licenseMatch) {
          result.metadata.license = licenseMatch[1].trim();
        }

        if (compatMatch) {
          result.metadata.compatibility = compatMatch[1].trim();
        }

        if (toolsMatch) {
          result.metadata.allowedTools = toolsMatch[1].split(',').map(t => t.trim());
        }

        if (metaMatch) {
          try {
            result.metadata.metadata = {};
            const metaLines = metaMatch[1].split('\n').filter(l => l.trim());
            for (const line of metaLines) {
              const [key, ...valueParts] = line.split(':');
              if (key && valueParts.length) {
                result.metadata.metadata[key.trim()] = valueParts.join(':').trim();
              }
            }
          } catch {
            result.warnings.push('metadata 格式解析失败');
          }
        }
      } else {
        result.valid = false;
        result.errors.push('SKILL.md 缺少 frontmatter (--- 包裹的 YAML)');
      }
    }

    rmSync(tempDir, { recursive: true, force: true });
  } catch (err) {
    result.valid = false;
    result.errors.push(`解压失败: ${err instanceof Error ? err.message : '未知错误'}`);
  }

  return result;
}

export function validateSkillDir(dirPath: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!existsSync(dirPath)) {
    result.valid = false;
    result.errors.push(`目录不存在: ${dirPath}`);
    return result;
  }

  const skillMdPath = join(dirPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    result.valid = false;
    result.errors.push('目录内缺少 SKILL.md 文件');
    return result;
  }

  try {
    const skillMdContent = readFileSync(skillMdPath, 'utf-8');
    const frontmatterMatch = skillMdContent.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.metadata = {};

      const nameMatch = frontmatter.match(/name:\s*(.+)/);
      const descMatch = frontmatter.match(/description:\s*(.+)/);

      if (nameMatch) {
        const name = nameMatch[1].trim();
        if (name.length < 1 || name.length > 64) {
          result.valid = false;
          result.errors.push('name 长度必须在 1-64 字符之间');
        }
        if (!/^[a-z0-9-]+$/.test(name)) {
          result.valid = false;
          result.errors.push('name 只能包含小写字母、数字和连字符');
        }
        result.metadata.name = name;
      } else {
        result.valid = false;
        result.errors.push('缺少 name 字段');
      }

      if (descMatch) {
        const desc = descMatch[1].trim();
        if (desc.length < 1 || desc.length > 1024) {
          result.valid = false;
          result.errors.push('description 长度必须在 1-1024 字符之间');
        }
        result.metadata.description = desc;
      } else {
        result.valid = false;
        result.errors.push('缺少 description 字段');
      }
    } else {
      result.valid = false;
      result.errors.push('SKILL.md 缺少 frontmatter (--- 包裹的 YAML)');
    }
  } catch (err) {
      result.warnings.push(`SKILL.md 读取失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }

  return result;
}

export interface AgentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    name?: string;
    version?: string;
    description?: string;
    prompt?: string;
    skills?: string[];
    knowledges?: string[];
  };
}

export function validateAgentDir(dirPath: string): AgentValidationResult {
  const result: AgentValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!existsSync(dirPath)) {
    result.valid = false;
    result.errors.push(`目录不存在: ${dirPath}`);
    return result;
  }

  const agentMdPath = join(dirPath, 'AGENT.md');
  if (!existsSync(agentMdPath)) {
    result.valid = false;
    result.errors.push('目录内缺少 AGENT.md 文件');
    return result;
  }

  try {
    const agentMdContent = readFileSync(agentMdPath, 'utf-8');
    const frontmatterMatch = agentMdContent.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.metadata = {};

      const nameMatch = frontmatter.match(/name:\s*(.+)/);
      const versionMatch = frontmatter.match(/version:\s*(.+)/);
      const descMatch = frontmatter.match(/description:\s*(.+)/);
      const skillsMatch = frontmatter.match(/skills:\s*([\s\S]*?)(?=\n\w|---)/);
      const knowledgesMatch = frontmatter.match(/knowledges:\s*([\s\S]*?)(?=\n\w|---)/);

      if (nameMatch) {
        result.metadata.name = nameMatch[1].trim();
      } else {
        result.valid = false;
        result.errors.push('缺少 name 字段');
      }

      if (versionMatch) {
        result.metadata.version = versionMatch[1].trim();
      }

      if (descMatch) {
        result.metadata.description = descMatch[1].trim();
      }

      if (skillsMatch) {
        const skillsLines = skillsMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
        result.metadata.skills = skillsLines.map(l => l.replace(/^\s*-\s*/, '').trim());
      }

      if (knowledgesMatch) {
        const knowledgesLines = knowledgesMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
        result.metadata.knowledges = knowledgesLines.map(l => l.replace(/^\s*-\s*/, '').trim());
      }

      const contentAfterFrontmatter = agentMdContent.replace(/^---[\s\S]*?---\n/, '');
      const promptMatch = contentAfterFrontmatter.match(/#\s*System\s*Prompt\n+([\s\S]*?)$/);
      if (promptMatch) {
        result.metadata.prompt = promptMatch[1].trim();
      } else if (contentAfterFrontmatter.trim()) {
        result.metadata.prompt = contentAfterFrontmatter.trim();
      }
    } else {
      result.valid = false;
      result.errors.push('AGENT.md 缺少 frontmatter (--- 包裹的 YAML)');
    }

    const skillsDir = join(dirPath, 'skills');
    if (existsSync(skillsDir) && statSync(skillsDir).isDirectory()) {
      const skillDirs = execSync(`ls -1 "${skillsDir}"`, { encoding: 'utf-8' })
        .split('\n')
        .filter(l => l.trim() && existsSync(join(skillsDir, l)) && statSync(join(skillsDir, l)).isDirectory());

      for (const skillDir of skillDirs) {
        const skillMdPath = join(skillsDir, skillDir, 'SKILL.md');
        if (!existsSync(skillMdPath)) {
          result.warnings.push(`skills/${skillDir} 目录内缺少 SKILL.md 文件`);
        }
      }
    }

    const knowledgesDir = join(dirPath, 'knowledges');
    if (existsSync(knowledgesDir) && statSync(knowledgesDir).isDirectory()) {
      const mdFiles = execSync(`ls -1 "${knowledgesDir}"`, { encoding: 'utf-8' })
        .split('\n')
        .filter(l => l.trim().endsWith('.md'));

      if (mdFiles.length === 0) {
        result.warnings.push('knowledges/ 目录内没有 .md 文件');
      }
    }
  } catch (err) {
    result.valid = false;
    result.errors.push(`AGENT.md 读取失败: ${err instanceof Error ? err.message : '未知错误'}`);
  }

  return result;
}