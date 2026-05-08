import { ApiClient } from '../lib/client';
import { loadConfig } from '../lib/storage';
import { formatAgent, formatAgentDetail, success, error, info } from '../lib/formatter';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';

interface JsonResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

function outputJson<T>(result: JsonResult<T>): void {
  console.log(JSON.stringify(result, null, 2));
}

function getJsonFlag(): boolean {
  return process.argv.includes('--json') || process.argv.includes('-j');
}

function getAgentIdentifier(identifier: string): { id: string; name: string } {
  if (identifier.includes('-')) {
    return { id: identifier, name: identifier };
  }
  return { id: identifier, name: identifier };
}

export async function createAgent(
  name: string,
  options: {
    description?: string;
    prompt?: string;
    avatar?: string;
    skills?: string[];
    knowledges?: string[];
    skillConfigs?: string[];
    knowledgeConfigs?: string[];
  } = {}
): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const skills = options.skills?.map((skillId, index) => ({
      skillId,
      config: options.skillConfigs?.[index] ? JSON.parse(options.skillConfigs[index]) : undefined,
    }));

    const knowledges = options.knowledges?.map((knowledgeId, index) => ({
      knowledgeId,
      retrievalConfig: options.knowledgeConfigs?.[index] ? JSON.parse(options.knowledgeConfigs[index]) : undefined,
    }));

    const result = await client.createAgent({
      name,
      description: options.description,
      prompt: options.prompt,
      avatar: options.avatar,
      skills,
      knowledges,
    });

    if (getJsonFlag()) {
      outputJson({ success: true, data: result });
      return;
    }
    success(`Agent "${name}" 创建成功 (ID: ${result.id})`);
  } catch (err) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'CREATE_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`创建失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function updateAgent(
  id: string,
  options: {
    name?: string;
    description?: string;
    prompt?: string;
    avatar?: string;
    status?: 'active' | 'draft';
  } = {}
): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const updateData: Partial<{
      name: string;
      description: string;
      prompt: string;
      avatar: string;
      status: 'active' | 'draft';
    }> = {};

    if (options.name !== undefined) updateData.name = options.name;
    if (options.description !== undefined) updateData.description = options.description;
    if (options.prompt !== undefined) updateData.prompt = options.prompt;
    if (options.avatar !== undefined) updateData.avatar = options.avatar;
    if (options.status !== undefined) updateData.status = options.status;

    const result = await client.updateAgent(id, updateData);

    if (getJsonFlag()) {
      outputJson({ success: true, data: result });
      return;
    }
    success(`Agent "${id}" 更新成功`);
  } catch (err) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'UPDATE_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`更新失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function deleteAgent(id: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    await client.deleteAgent(id);

    if (getJsonFlag()) {
      outputJson({ success: true, data: { id } });
      return;
    }
    success(`Agent "${id}" 删除成功`);
  } catch (err) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'DELETE_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function bindSkill(id: string, skillId: string, config?: string): Promise<void> {
  const configStore = loadConfig();
  if (!configStore?.token) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(configStore.serverUrl, configStore.token);
  try {
    const parsedConfig = config ? JSON.parse(config) : undefined;
    await client.bindSkillToAgent(id, skillId, parsedConfig);

    if (getJsonFlag()) {
      outputJson({ success: true, data: { agentId: id, skillId, config: parsedConfig } });
      return;
    }
    success(`Skill "${skillId}" 已绑定到 Agent "${id}"`);
  } catch (err) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'BIND_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`绑定失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function unbindSkill(id: string, skillId: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    await client.unbindSkillFromAgent(id, skillId);

    if (getJsonFlag()) {
      outputJson({ success: true, data: { agentId: id, skillId } });
      return;
    }
    success(`Skill "${skillId}" 已从 Agent "${id}" 解绑`);
  } catch (err) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'UNBIND_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`解绑失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function bindKnowledge(id: string, knowledgeId: string, retrievalConfig?: string): Promise<void> {
  const configStore = loadConfig();
  if (!configStore?.token) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(configStore.serverUrl, configStore.token);
  try {
    const parsedConfig = retrievalConfig ? JSON.parse(retrievalConfig) : undefined;
    await client.bindKnowledgeToAgent(id, knowledgeId, parsedConfig);

    if (getJsonFlag()) {
      outputJson({ success: true, data: { agentId: id, knowledgeId, retrievalConfig: parsedConfig } });
      return;
    }
    success(`Knowledge "${knowledgeId}" 已绑定到 Agent "${id}"`);
  } catch (err) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'BIND_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`绑定失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function unbindKnowledge(id: string, knowledgeId: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    await client.unbindKnowledgeFromAgent(id, knowledgeId);

    if (getJsonFlag()) {
      outputJson({ success: true, data: { agentId: id, knowledgeId } });
      return;
    }
    success(`Knowledge "${knowledgeId}" 已从 Agent "${id}" 解绑`);
  } catch (err) {
    if (getJsonFlag()) {
      outputJson({ success: false, error: { code: 'UNBIND_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`解绑失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function listAgents(): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
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
    error('未登录，请先运行 arm login');
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
    error('未登录，请先运行 arm login');
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

    if (fullAgent.knowledges && fullAgent.knowledges.length > 0) {
      const knowledgeNamePromises = fullAgent.knowledges.map(async (k) => {
        try {
          const knowledge = await client.getKnowledge(k.knowledgeId);
          return { knowledgeId: k.knowledgeId, knowledgeName: knowledge.name, retrievalConfig: k.retrievalConfig };
        } catch {
          return k;
        }
      });
      fullAgent.knowledges = await Promise.all(knowledgeNamePromises);
    }

    console.log(formatAgentDetail(fullAgent));
  } catch (err) {
    error(`获取详情失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function downloadAgent(name: string, outputDir?: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
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