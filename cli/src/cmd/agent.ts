import { ApiClient } from '../lib/client';
import { loadConfig } from '../lib/storage';
import { formatAgent, formatAgentDetail, success, error, info } from '../lib/formatter';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';

export async function listAgents(): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listAgents();
    if (result.agents.length === 0) {
      info('暂无 Agent');
      return;
    }
    console.log(`\n共 ${result.total} 个 Agent:\n`);
    for (const agent of result.agents) {
      console.log(formatAgent(agent));
      console.log('');
    }
  } catch (err) {
    error(`获取列表失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function searchAgents(keyword: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listAgents(keyword);
    if (result.agents.length === 0) {
      info(`没有找到包含 "${keyword}" 的 Agent`);
      return;
    }
    console.log(`\n找到 ${result.total} 个结果:\n`);
    for (const agent of result.agents) {
      console.log(formatAgent(agent));
      console.log('');
    }
  } catch (err) {
    error(`搜索失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function infoAgent(name: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listAgents(name);
    const agent = result.agents.find((a) => a.name === name);
    if (!agent) {
      error(`Agent "${name}" 不存在`);
      process.exit(1);
    }

    const fullAgent = await client.getAgent(agent.id);
    console.log(formatAgentDetail(fullAgent));
  } catch (err) {
    error(`获取详情失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function downloadAgent(name: string, outputDir?: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listAgents(name);
    const agent = result.agents.find((a) => a.name === name);
    if (!agent) {
      error(`Agent "${name}" 不存在`);
      process.exit(1);
    }

    info(`正在下载 ${name}...`);
    const { buffer, version } = await client.downloadAgent(agent.id);

    const tempDir = mkdtempSync('/tmp/agent-download-');
    const zipPath = join(tempDir, `${name}.zip`);
    writeFileSync(zipPath, Buffer.from(buffer));

    const targetDir = join(outputDir || '.', name);
    execSync(`mkdir -p "${targetDir}"`, { stdio: 'pipe' });
    execSync(`unzip -q "${zipPath}" -d "${tempDir}"`, { stdio: 'pipe' });
    
    const contentDir = join(tempDir, 'agent-content');
    if (existsSync(contentDir)) {
      execSync(`cp -r "${contentDir}"/* "${targetDir}/"`, { stdio: 'pipe' });
    } else {
      execSync(`cp -r "${tempDir}"/* "${targetDir}/"`, { stdio: 'pipe' });
    }

    rmSync(tempDir, { recursive: true, force: true });

    success(`已下载到 ${targetDir} (版本: ${version})`);
  } catch (err) {
    error(`下载失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}