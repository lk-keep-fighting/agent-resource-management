import { ApiClient } from '../lib/client';
import { loadConfig } from '../lib/storage';
import { formatSkill, formatSkillDetail, success, error, info } from '../lib/formatter';
import { validateZip, validateSkillDir } from '../lib/validate';
import { writeFileSync, createWriteStream, existsSync, mkdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';

export async function listSkills(): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listSkills();
    if (result.skills.length === 0) {
      info('暂无 Skill');
      return;
    }
    console.log(`\n共 ${result.total} 个 Skill:\n`);
    for (const skill of result.skills) {
      console.log(formatSkill(skill));
      console.log('');
    }
  } catch (err) {
    error(`获取列表失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function searchSkills(keyword: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listSkills(keyword);
    if (result.skills.length === 0) {
      info(`没有找到包含 "${keyword}" 的 Skill`);
      return;
    }
    console.log(`\n找到 ${result.total} 个结果:\n`);
    for (const skill of result.skills) {
      console.log(formatSkill(skill));
      console.log('');
    }
  } catch (err) {
    error(`搜索失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function infoSkill(name: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const skill = await client.getSkill(name);
    console.log(formatSkillDetail(skill));
  } catch (err) {
    error(`获取详情失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function downloadSkill(name: string, outputDir?: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    info(`正在下载 ${name}...`);
    const buffer = await client.downloadSkill(name);
    const outputPath = join(outputDir || '.', `${name}.zip`);
    writeFileSync(outputPath, Buffer.from(buffer));
    success(`已下载到 ${outputPath}`);
  } catch (err) {
    error(`下载失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function uploadSkill(filePath: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    error(`上传失败: 目录不存在: ${filePath}`);
    process.exit(1);
  }

  const validation = validateSkillDir(filePath);
  if (!validation.valid) {
    error(`上传失败: ${validation.errors.join(', ')}`);
    process.exit(1);
  }

  const skillName = validation.metadata?.name || basename(filePath);
  const tempDir = mkdtempSync('/tmp/skill-upload-');
  const zipPath = join(tempDir, `${skillName}.zip`);

  try {
    execSync(`cd "${dirname(filePath)}" && zip -r "${zipPath}" "${basename(filePath)}" -x ".*"`, { stdio: 'pipe' });

    const client = new ApiClient(config.serverUrl, config.token);
    info(`正在上传 ${filePath}...`);
    const skill = await client.uploadSkill(zipPath);
    success(`上传成功! Skill: ${skill.name}`);
  } catch (err) {
    error(`上传失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function mySkills(): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const skills = await client.getMySkills();
    if (skills.length === 0) {
      info('您还没有发布任何 Skill');
      return;
    }
    console.log(`\n我发布的 Skill (共 ${skills.length}):\n`);
    for (const skill of skills) {
      console.log(formatSkill(skill));
      console.log('');
    }
  } catch (err) {
    error(`获取列表失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function deleteSkill(name: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    await client.deleteSkill(name);
    success(`已删除 ${name}`);
  } catch (err) {
    error(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function validateSkill(filePath: string): Promise<void> {
  const isDir = existsSync(filePath) && statSync(filePath).isDirectory();
  const result = isDir ? validateSkillDir(filePath) : validateZip(filePath);

  if (result.valid) {
    success('验证通过!');
  } else {
    error('验证失败:');
  }

  if (result.errors.length > 0) {
    console.log('\n错误:');
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\n警告:');
    for (const warn of result.warnings) {
      console.log(`  - ${warn}`);
    }
  }

  if (result.metadata) {
    console.log('\n元数据:');
    if (result.metadata.name) console.log(`  name: ${result.metadata.name}`);
    if (result.metadata.description) console.log(`  description: ${result.metadata.description}`);
    if (result.metadata.license) console.log(`  license: ${result.metadata.license}`);
    if (result.metadata.compatibility) console.log(`  compatibility: ${result.metadata.compatibility}`);
    if (result.metadata.allowedTools) console.log(`  allowed-tools: ${result.metadata.allowedTools.join(', ')}`);
  }

  if (!result.valid) {
    process.exit(1);
  }
}