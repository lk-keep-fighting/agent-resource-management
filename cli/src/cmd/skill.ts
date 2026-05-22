import { ApiClient } from '../lib/client';
import { loadConfig } from '../lib/storage';
import { formatSkill, formatSkillDetail, success, error, info } from '../lib/formatter';
import { shouldOutputJson, outputJson } from '../lib/output';
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
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listSkills();
    if (shouldOutputJson()) {
      outputJson({ success: true, data: result });
      return;
    }
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
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'LIST_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`获取列表失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function searchSkills(keyword: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listSkills(keyword);
    if (shouldOutputJson()) {
      outputJson({ success: true, data: result });
      return;
    }
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
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'SEARCH_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`搜索失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function infoSkill(name: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const skill = await client.getSkill(name);
    if (shouldOutputJson()) {
      outputJson({ success: true, data: skill });
      return;
    }
    console.log(formatSkillDetail(skill));
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'INFO_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`获取详情失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function downloadSkill(name: string, outputDir?: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    if (shouldOutputJson()) {
      info(`正在下载 ${name}...`);
    }
    const buffer = await client.downloadSkill(name);

    const tempDir = mkdtempSync('/tmp/skill-download-');
    const zipPath = join(tempDir, `${name}.zip`);
    writeFileSync(zipPath, Buffer.from(buffer));

    execSync(`unzip -q "${zipPath}" -d "${tempDir}"`, { stdio: 'pipe' });

    const targetDir = join(outputDir || '.', name);
    execSync(`mkdir -p "${targetDir}"`, { stdio: 'pipe' });

    const entries = execSync(`ls -1 "${tempDir}"`, { encoding: 'utf-8' }).split('\n').filter(e => e.trim());

    const nonZipEntries = entries.filter(e => e !== `${name}.zip`);

    if (nonZipEntries.length === 1) {
      const onlyEntry = join(tempDir, nonZipEntries[0]);
      if (statSync(onlyEntry).isDirectory()) {
        execSync(`cp -r "${onlyEntry}"/* "${targetDir}/"`, { stdio: 'pipe' });
      } else {
        execSync(`cp -r "${onlyEntry}" "${targetDir}/"`, { stdio: 'pipe' });
      }
    } else {
      for (const entry of nonZipEntries) {
        execSync(`cp -r "${join(tempDir, entry)}" "${targetDir}/"`, { stdio: 'pipe' });
      }
    }

    rmSync(tempDir, { recursive: true, force: true });

    if (shouldOutputJson()) {
      outputJson({ success: true, data: { path: targetDir } });
      return;
    }
    success(`已下载到 ${targetDir}`);
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'DOWNLOAD_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`下载失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function uploadSkill(filePath: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'FILE_NOT_FOUND', message: `上传失败: 目录不存在: ${filePath}` } });
      process.exit(1);
    }
    error(`上传失败: 目录不存在: ${filePath}`);
    process.exit(1);
  }

  const isZip = filePath.toLowerCase().endsWith('.zip');
  const validation = isZip ? validateZip(filePath) : validateSkillDir(filePath);
  if (!validation.valid) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'VALIDATION_FAILED', message: validation.errors.join(', ') } });
      process.exit(1);
    }
    error(`上传失败: ${validation.errors.join(', ')}`);
    process.exit(1);
  }

  const skillName = validation.metadata?.name || basename(filePath);
  const tempDir = mkdtempSync('/tmp/skill-upload-');
  const zipPath = join(tempDir, `${skillName}.zip`);

  try {
    if (isZip) {
      execSync(`cp "${filePath}" "${zipPath}"`, { stdio: 'pipe' });
    } else {
      execSync(`cd "${dirname(filePath)}" && zip -r "${zipPath}" "${basename(filePath)}" -x ".*"`, { stdio: 'pipe' });
    }

    const client = new ApiClient(config.serverUrl, config.token);
    if (shouldOutputJson()) {
      info(`正在上传 ${filePath}...`);
    }
    const skill = await client.uploadSkill(zipPath);
    if (shouldOutputJson()) {
      outputJson({ success: true, data: skill });
      return;
    }
    success(`上传成功! Skill: ${skill.name}`);
  } catch (err) {
    console.error('DEBUG upload error:', err);
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'UPLOAD_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`上传失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function mySkills(): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const skills = await client.getMySkills();
    if (shouldOutputJson()) {
      outputJson({ success: true, data: skills });
      return;
    }
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
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'LIST_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`获取列表失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function deleteSkill(name: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    await client.deleteSkill(name);
    if (shouldOutputJson()) {
      outputJson({ success: true, data: { name } });
      return;
    }
    success(`已删除 ${name}`);
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'DELETE_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function validateSkill(filePath: string): Promise<void> {
  const isDir = existsSync(filePath) && statSync(filePath).isDirectory();
  const result = isDir ? validateSkillDir(filePath) : validateZip(filePath);

  if (shouldOutputJson()) {
    outputJson({
      success: result.valid,
      data: {
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        metadata: result.metadata,
      },
    });
    if (!result.valid) {
      process.exit(1);
    }
    return;
  }

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