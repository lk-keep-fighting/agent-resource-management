import { ApiClient } from '../lib/client';
import { loadConfig } from '../lib/storage';
import { formatKnowledge, formatKnowledgeDetail, success, error, info } from '../lib/formatter';
import { writeFileSync, existsSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';

export async function listKnowledge(): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listKnowledge();
    if (result.knowledges.length === 0) {
      info('暂无 Knowledge');
      return;
    }
    console.log(`\n共 ${result.total} 个 Knowledge:\n`);
    for (const knowledge of result.knowledges) {
      console.log(formatKnowledge(knowledge));
      console.log('');
    }
  } catch (err) {
    error(`获取列表失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function searchKnowledge(keyword: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listKnowledge(keyword);
    if (result.knowledges.length === 0) {
      info(`没有找到包含 "${keyword}" 的 Knowledge`);
      return;
    }
    console.log(`\n找到 ${result.total} 个结果:\n`);
    for (const knowledge of result.knowledges) {
      console.log(formatKnowledge(knowledge));
      console.log('');
    }
  } catch (err) {
    error(`搜索失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function infoKnowledge(name: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const knowledge = await client.getKnowledge(name);
    console.log(formatKnowledgeDetail(knowledge));
  } catch (err) {
    error(`获取详情失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function downloadKnowledge(name: string, outputDir?: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    info(`正在下载 ${name}...`);
    const buffer = await client.downloadKnowledge(name);
    const outputPath = join(outputDir || '.', `${name}.zip`);
    writeFileSync(outputPath, Buffer.from(buffer));
    success(`已下载到 ${outputPath}`);
  } catch (err) {
    error(`下载失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function uploadKnowledge(filePath: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    error(`上传失败: 目录不存在: ${filePath}`);
    process.exit(1);
  }

  const knowledgeName = basename(filePath);
  const tempDir = mkdtempSync('/tmp/knowledge-upload-');
  const zipPath = join(tempDir, `${knowledgeName}.zip`);

  try {
    if (statSync(filePath).isDirectory()) {
      execSync(`cd "${dirname(filePath)}" && zip -r "${zipPath}" "${basename(filePath)}" -x ".*"`, { stdio: 'pipe' });
    } else {
      execSync(`cp "${filePath}" "${zipPath}"`, { stdio: 'pipe' });
    }

    const client = new ApiClient(config.serverUrl, config.token);
    info(`正在上传 ${filePath}...`);
    const knowledge = await client.uploadKnowledge(zipPath);
    success(`上传成功! Knowledge: ${knowledge.name}`);
  } catch (err) {
    error(`上传失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function myKnowledge(): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const knowledges = await client.getMyKnowledge();
    if (knowledges.length === 0) {
      info('您还没有发布任何 Knowledge');
      return;
    }
    console.log(`\n我发布的 Knowledge (共 ${knowledges.length}):\n`);
    for (const knowledge of knowledges) {
      console.log(formatKnowledge(knowledge));
      console.log('');
    }
  } catch (err) {
    error(`获取列表失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function deleteKnowledge(name: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    await client.deleteKnowledge(name);
    success(`已删除 ${name}`);
  } catch (err) {
    error(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}