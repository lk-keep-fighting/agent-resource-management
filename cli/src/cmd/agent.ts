import { ApiClient } from '../lib/client';
import { loadConfig } from '../lib/storage';
import { formatAgent, formatAgentDetail, success, error, info } from '../lib/formatter';
import { shouldOutputJson, outputJson } from '../lib/output';
import { validateAgentDir } from '../lib/validate';
import { writeFileSync, existsSync, readFileSync, statSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';

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
    if (shouldOutputJson()) {
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

    if (shouldOutputJson()) {
      outputJson({ success: true, data: result });
      return;
    }
    success(`Agent "${name}" 创建成功 (ID: ${result.id})`);
  } catch (err) {
    if (shouldOutputJson()) {
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
    if (shouldOutputJson()) {
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

    if (shouldOutputJson()) {
      outputJson({ success: true, data: result });
      return;
    }
    success(`Agent "${id}" 更新成功`);
  } catch (err) {
    if (shouldOutputJson()) {
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
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    await client.deleteAgent(id);

    if (shouldOutputJson()) {
      outputJson({ success: true, data: { id } });
      return;
    }
    success(`Agent "${id}" 删除成功`);
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'DELETE_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function bindSkill(id: string, skillId: string, version: string = '1.0.0', config?: string): Promise<void> {
  const configStore = loadConfig();
  if (!configStore?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(configStore.serverUrl, configStore.token);
  try {
    const parsedConfig = config ? JSON.parse(config) : undefined;
    await client.bindSkillToAgent(id, skillId, version, parsedConfig);

    if (shouldOutputJson()) {
      outputJson({ success: true, data: { agentId: id, skillId, version, config: parsedConfig } });
      return;
    }
    success(`Skill "${skillId}@${version}" 已绑定到 Agent "${id}"`);
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'BIND_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`绑定失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function unbindSkill(id: string, skillId: string, version?: string): Promise<void> {
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
    await client.unbindSkillFromAgent(id, skillId, version);

    if (shouldOutputJson()) {
      outputJson({ success: true, data: { agentId: id, skillId, version } });
      return;
    }
    success(`Skill "${skillId}${version ? '@' + version : ''}" 已从 Agent "${id}" 解绑`);
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'UNBIND_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`解绑失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function bindKnowledge(id: string, knowledgeId: string, version: string = '1.0.0', retrievalConfig?: string, kind?: 'essential' | 'experience'): Promise<void> {
  const configStore = loadConfig();
  if (!configStore?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(configStore.serverUrl, configStore.token);
  try {
    const parsedConfig = retrievalConfig ? JSON.parse(retrievalConfig) : undefined;
    await client.bindKnowledgeToAgent(id, knowledgeId, version, parsedConfig, kind);

    if (shouldOutputJson()) {
      outputJson({ success: true, data: { agentId: id, knowledgeId, version, kind: kind ?? 'experience', retrievalConfig: parsedConfig } });
      return;
    }
    success(`Knowledge "${knowledgeId}@${version}"（${kind ?? 'experience'}）已绑定到 Agent "${id}"`);
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'BIND_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`绑定失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function unbindKnowledge(id: string, knowledgeId: string, version?: string): Promise<void> {
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
    await client.unbindKnowledgeFromAgent(id, knowledgeId, version);

    if (shouldOutputJson()) {
      outputJson({ success: true, data: { agentId: id, knowledgeId, version } });
      return;
    }
    success(`Knowledge "${knowledgeId}${version ? '@' + version : ''}" 已从 Agent "${id}" 解绑`);
  } catch (err) {
    if (shouldOutputJson()) {
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
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const result = await client.listAgents();
    if (shouldOutputJson()) {
      outputJson({ success: true, data: result });
      return;
    }
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
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'LIST_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`获取列表失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function searchAgents(keyword: string): Promise<void> {
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
    const result = await client.listAgents(keyword);
    if (shouldOutputJson()) {
      outputJson({ success: true, data: result });
      return;
    }
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
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'SEARCH_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`搜索失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function infoAgent(name: string): Promise<void> {
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
    const result = await client.listAgents(name);
    const agent = result.agents.find((a) => a.name === name);
    if (!agent) {
      if (shouldOutputJson()) {
        outputJson({ success: false, error: { code: 'NOT_FOUND', message: `Agent "${name}" 不存在` } });
        process.exit(1);
      }
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

    if (shouldOutputJson()) {
      outputJson({ success: true, data: fullAgent });
      return;
    }
    console.log(formatAgentDetail(fullAgent));
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'INFO_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`获取详情失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function downloadAgent(name: string, outputDir?: string): Promise<void> {
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
    const result = await client.listAgents(name);
    const agent = result.agents.find((a) => a.name === name);
    if (!agent) {
      if (shouldOutputJson()) {
        outputJson({ success: false, error: { code: 'NOT_FOUND', message: `Agent "${name}" 不存在` } });
        process.exit(1);
      }
      error(`Agent "${name}" 不存在`);
      process.exit(1);
    }

    if (shouldOutputJson()) {
      info(`正在下载 ${name}...`);
    }
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

    if (shouldOutputJson()) {
      outputJson({ success: true, data: { path: targetDir, version } });
      return;
    }
    success(`已下载到 ${targetDir} (版本: ${version})`);
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'DOWNLOAD_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`下载失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function createAgentFromFolder(folderPath: string): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  if (!existsSync(folderPath)) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'FILE_NOT_FOUND', message: `目录不存在: ${folderPath}` } });
      process.exit(1);
    }
    error(`目录不存在: ${folderPath}`);
    process.exit(1);
  }

  const validation = validateAgentDir(folderPath);
  if (!validation.valid) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'VALIDATION_FAILED', message: validation.errors.join(', ') } });
      process.exit(1);
    }
    error(`验证失败: ${validation.errors.join(', ')}`);
    process.exit(1);
  }

  if (shouldOutputJson()) {
    info('正在解析 Agent 文件夹...');
  }

  const metadata = validation.metadata!;
  const client = new ApiClient(config.serverUrl, config.token);

  const uploadedSkills: { name: string; id: string }[] = [];
  const uploadedKnowledges: { title: string; id: string }[] = [];

  const skillsDir = join(folderPath, 'skills');
  if (existsSync(skillsDir) && statSync(skillsDir).isDirectory()) {
    const skillDirs = execSync(`ls -1 "${skillsDir}"`, { encoding: 'utf-8' })
      .split('\n')
      .filter(l => l.trim() && existsSync(join(skillsDir, l)) && statSync(join(skillsDir, l)).isDirectory());

    for (const skillDir of skillDirs) {
      const skillPath = join(skillsDir, skillDir);
      try {
        const existingSkill = await client.getSkill(skillDir).catch(() => null);
        if (existingSkill) {
          if (shouldOutputJson()) {
            info(`技能 ${skillDir} 已存在，将仅绑定`);
          }
          uploadedSkills.push({ name: skillDir, id: existingSkill.id });
        } else {
          if (shouldOutputJson()) {
            info(`上传新技能: ${skillDir}`);
          }
          const skillTempDir = mkdtempSync('/tmp/skill-upload-');
          const zipPath = join(skillTempDir, `${skillDir}.zip`);
          execSync(`cd "${skillPath}" && zip -r "${zipPath}" . -x ".*"`, { stdio: 'pipe' });
          const uploadedSkill = await client.uploadSkill(zipPath);
          uploadedSkills.push({ name: skillDir, id: uploadedSkill.id });
          rmSync(skillTempDir, { recursive: true, force: true });
        }
      } catch (err) {
        if (shouldOutputJson()) {
          outputJson({ success: false, error: { code: 'SKILL_UPLOAD_FAILED', message: `处理技能 ${skillDir} 失败: ${err instanceof Error ? err.message : '未知错误'}` } });
          process.exit(1);
        }
        error(`处理技能 ${skillDir} 失败: ${err instanceof Error ? err.message : '未知错误'}`);
        process.exit(1);
      }
    }
  }

  const knowledgesDir = join(folderPath, 'knowledges');
  if (existsSync(knowledgesDir) && statSync(knowledgesDir).isDirectory()) {
    const mdFiles = execSync(`ls -1 "${knowledgesDir}"`, { encoding: 'utf-8' })
      .split('\n')
      .filter(l => l.trim().endsWith('.md'));

    for (const mdFile of mdFiles) {
      const mdPath = join(knowledgesDir, mdFile);
      const knowledgeName = mdFile.replace('.md', '');
      try {
        const existingKnowledge = await client.getKnowledge(knowledgeName).catch(() => null);
        if (existingKnowledge) {
          if (shouldOutputJson()) {
            info(`知识 ${knowledgeName} 已存在，将仅绑定`);
          }
          uploadedKnowledges.push({ title: knowledgeName, id: existingKnowledge.id });
        } else {
          if (shouldOutputJson()) {
            info(`上传新知识: ${knowledgeName}`);
          }
          const uploadedKnowledge = await client.uploadKnowledge(mdPath);
          uploadedKnowledges.push({ title: knowledgeName, id: uploadedKnowledge.id });
        }
      } catch (err) {
        if (shouldOutputJson()) {
          outputJson({ success: false, error: { code: 'KNOWLEDGE_UPLOAD_FAILED', message: `处理知识 ${knowledgeName} 失败: ${err instanceof Error ? err.message : '未知错误'}` } });
          process.exit(1);
        }
        error(`处理知识 ${knowledgeName} 失败: ${err instanceof Error ? err.message : '未知错误'}`);
        process.exit(1);
      }
    }
  }

  if (shouldOutputJson()) {
    info(`创建 Agent: ${metadata.name}`);
  }

  try {
    const agent = await client.createAgent({
      name: metadata.name!,
      description: metadata.description,
      prompt: metadata.prompt,
    });

    for (const skill of uploadedSkills) {
      if (shouldOutputJson()) {
        info(`绑定技能: ${skill.name}`);
      }
      await client.bindSkillToAgent(agent.id, skill.id, undefined);
    }

    for (const knowledge of uploadedKnowledges) {
      if (shouldOutputJson()) {
        info(`绑定知识: ${knowledge.title}`);
      }
      await client.bindKnowledgeToAgent(agent.id, knowledge.id, undefined);
    }

    if (shouldOutputJson()) {
      outputJson({
        success: true,
        data: {
          id: agent.id,
          name: agent.name,
          skillsCount: uploadedSkills.length,
          knowledgesCount: uploadedKnowledges.length,
        },
      });
      return;
    }
    success(`Agent "${metadata.name}" 创建成功 (ID: ${agent.id})`);
    success(`已绑定 ${uploadedSkills.length} 个技能和 ${uploadedKnowledges.length} 个知识`);
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'CREATE_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`创建失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export interface SyncOptions {
  dryRun?: boolean;
  force?: boolean;
}

interface LocalSkill {
  name: string;
  path: string;
  version: string;
}

interface LocalKnowledge {
  name: string;
  path: string;
  version: string;
}

export async function syncAgent(folderPath: string, options: SyncOptions = {}): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录，请先运行 arm login' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  if (!existsSync(folderPath)) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'FILE_NOT_FOUND', message: `目录不存在: ${folderPath}` } });
      process.exit(1);
    }
    error(`目录不存在: ${folderPath}`);
    process.exit(1);
  }

  const validation = validateAgentDir(folderPath);
  if (!validation.valid) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'VALIDATION_FAILED', message: validation.errors.join(', ') } });
      process.exit(1);
    }
    error(`验证失败: ${validation.errors.join(', ')}`);
    process.exit(1);
  }

  const metadata = validation.metadata!;
  const agentName = metadata.name!;
  const client = new ApiClient(config.serverUrl, config.token);

  if (shouldOutputJson()) {
    info(`正在同步 Agent: ${agentName}...`);
  }

  try {
    const result = await client.listAgents(agentName, 1, 1);
    const existingAgent = result.agents.find(a => a.name === agentName);

    if (!existingAgent) {
      if (shouldOutputJson()) {
        outputJson({ success: false, error: { code: 'NOT_FOUND', message: `Agent "${agentName}" 不存在，请先使用 arm agent create --from 创建` } });
        process.exit(1);
      }
      error(`Agent "${agentName}" 不存在，请先使用 arm agent create --from 创建`);
      process.exit(1);
    }

    const cloudAgent = await client.getAgent(existingAgent.id);

    const localSkills = await parseLocalSkills(folderPath);
    const localKnowledges = await parseLocalKnowledges(folderPath);

    const cloudSkillBindings = cloudAgent.skills || [];
    const cloudKnowledgeBindings = cloudAgent.knowledges || [];

    const changes: {
      metadataChanged: boolean;
      newSkills: LocalSkill[];
      removedSkills: string[];
      newKnowledges: LocalKnowledge[];
      removedKnowledges: string[];
    } = {
      metadataChanged: false,
      newSkills: [],
      removedSkills: [],
      newKnowledges: [],
      removedKnowledges: [],
    };

    if (cloudAgent.prompt !== metadata.prompt || cloudAgent.description !== metadata.description) {
      changes.metadataChanged = true;
    }

    const cloudSkillNames = new Set(cloudSkillBindings.map(s => s.skill?.name).filter(Boolean));
    for (const localSkill of localSkills) {
      const existingBinding = cloudSkillBindings.find(
        sb => sb.skill?.name === localSkill.name && sb.version === localSkill.version
      );
      if (!existingBinding) {
        changes.newSkills.push(localSkill);
      }
    }
    const localSkillNames = new Set(localSkills.map(s => s.name));
    for (const cloudBinding of cloudSkillBindings) {
      if (cloudBinding.skill?.name && !localSkillNames.has(cloudBinding.skill.name)) {
        changes.removedSkills.push(cloudBinding.skill.name);
      }
    }

    const cloudKnowledgeNames = new Set(cloudKnowledgeBindings.map(k => k.knowledge?.name).filter(Boolean));
    for (const localKnowledge of localKnowledges) {
      const existingBinding = cloudKnowledgeBindings.find(
        kb => kb.knowledge?.name === localKnowledge.name && kb.version === localKnowledge.version
      );
      if (!existingBinding) {
        changes.newKnowledges.push(localKnowledge);
      }
    }
    const localKnowledgeNames = new Set(localKnowledges.map(k => k.name));
    for (const cloudBinding of cloudKnowledgeBindings) {
      if (cloudBinding.knowledge?.name && !localKnowledgeNames.has(cloudBinding.knowledge.name)) {
        changes.removedKnowledges.push(cloudBinding.knowledge.name);
      }
    }

    if (options.dryRun) {
      if (shouldOutputJson()) {
        outputJson({
          success: true,
          data: {
            agentName,
            agentId: existingAgent.id,
            changes,
            dryRun: true,
          },
        });
        return;
      }
      console.log(`\n[DRY-RUN] 预览 ${agentName} 的变更:\n`);
      if (changes.metadataChanged) {
        console.log('  元信息: 将更新 (prompt/description 变更)');
      }
      if (changes.newSkills.length > 0) {
        console.log(`  新增 Skills: ${changes.newSkills.map(s => `${s.name}@${s.version}`).join(', ')}`);
      }
      if (changes.removedSkills.length > 0) {
        console.log(`  移除 Skills: ${changes.removedSkills.join(', ')}`);
      }
      if (changes.newKnowledges.length > 0) {
        console.log(`  新增 Knowledges: ${changes.newKnowledges.map(k => `${k.name}@${k.version}`).join(', ')}`);
      }
      if (changes.removedKnowledges.length > 0) {
        console.log(`  移除 Knowledges: ${changes.removedKnowledges.join(', ')}`);
      }
      if (!changes.metadataChanged && changes.newSkills.length === 0 && changes.removedSkills.length === 0 &&
          changes.newKnowledges.length === 0 && changes.removedKnowledges.length === 0) {
        console.log('  无变更');
      }
      return;
    }

    if (changes.metadataChanged) {
      if (shouldOutputJson()) {
        info('更新 Agent 元信息...');
      }
      await client.updateAgent(existingAgent.id, {
        prompt: metadata.prompt,
        description: metadata.description,
      });
    }

    for (const skill of changes.newSkills) {
      if (shouldOutputJson()) {
        info(`上传并绑定新技能: ${skill.name} (版本自动分配)`);
      }
      const skillTempDir = mkdtempSync('/tmp/skill-sync-');
      const zipPath = join(skillTempDir, `${skill.name}.zip`);
      execSync(`cd "${skill.path}" && zip -r "${zipPath}" . -x ".*"`, { stdio: 'pipe' });
      try {
        const uploadedSkill = await client.uploadSkill(zipPath);
        await client.bindSkillToAgent(existingAgent.id, uploadedSkill.id, undefined);
      } finally {
        rmSync(skillTempDir, { recursive: true, force: true });
      }
    }

    for (const skillName of changes.removedSkills) {
      const binding = cloudSkillBindings.find(sb => sb.skill?.name === skillName);
      if (binding) {
        if (shouldOutputJson()) {
          info(`解绑技能: ${skillName}`);
        }
        await client.unbindSkillFromAgent(existingAgent.id, binding.skillId, binding.version);
      }
    }

    for (const knowledge of changes.newKnowledges) {
      if (shouldOutputJson()) {
        info(`上传并绑定新知识: ${knowledge.name} (版本自动分配)`);
      }
      const uploadedKnowledge = await client.uploadKnowledge(knowledge.path);
      await client.bindKnowledgeToAgent(existingAgent.id, uploadedKnowledge.id, undefined);
    }

    for (const knowledgeName of changes.removedKnowledges) {
      const binding = cloudKnowledgeBindings.find(kb => kb.knowledge?.name === knowledgeName);
      if (binding) {
        if (shouldOutputJson()) {
          info(`解绑知识: ${knowledgeName}`);
        }
        await client.unbindKnowledgeFromAgent(existingAgent.id, binding.knowledgeId, binding.version);
      }
    }

    if (shouldOutputJson()) {
      outputJson({
        success: true,
        data: {
          agentName,
          agentId: existingAgent.id,
          changes,
        },
      });
      return;
    }
    success(`Agent "${agentName}" 同步完成`);
    const changeCount = (changes.metadataChanged ? 1 : 0) + changes.newSkills.length +
      changes.removedSkills.length + changes.newKnowledges.length + changes.removedKnowledges.length;
    if (changeCount === 0) {
      info('无变更');
    } else {
      console.log(`  更新了 ${changeCount} 项`);
    }
  } catch (err) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'SYNC_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`同步失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

async function parseLocalSkills(folderPath: string): Promise<LocalSkill[]> {
  const skills: LocalSkill[] = [];
  const skillsDir = join(folderPath, 'skills');

  if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) {
    return skills;
  }

  try {
    const skillDirs = execSync(`ls -1 "${skillsDir}"`, { encoding: 'utf-8' })
      .split('\n')
      .filter(l => l.trim() && existsSync(join(skillsDir, l)) && statSync(join(skillsDir, l)).isDirectory());

    for (const skillDir of skillDirs) {
      const skillPath = join(skillsDir, skillDir);
      const skillMdPath = join(skillPath, 'SKILL.md');

      if (existsSync(skillMdPath)) {
        const content = readFileSync(skillMdPath, 'utf-8');
        const versionMatch = content.match(/^---\n[\s\S]*?version:\s*(.+)\n/);
        const version = versionMatch ? versionMatch[1].trim() : '1.0.0';
        skills.push({ name: skillDir, path: skillPath, version });
      }
    }
  } catch {
  }

  return skills;
}

async function parseLocalKnowledges(folderPath: string): Promise<LocalKnowledge[]> {
  const knowledges: LocalKnowledge[] = [];
  const knowledgesDir = join(folderPath, 'knowledges');

  if (!existsSync(knowledgesDir) || !statSync(knowledgesDir).isDirectory()) {
    return knowledges;
  }

  try {
    const mdFiles = execSync(`ls -1 "${knowledgesDir}"`, { encoding: 'utf-8' })
      .split('\n')
      .filter(l => l.trim().endsWith('.md'));

    for (const mdFile of mdFiles) {
      const mdPath = join(knowledgesDir, mdFile);
      const name = mdFile.replace('.md', '');
      const content = readFileSync(mdPath, 'utf-8');
      const versionMatch = content.match(/^---\n[\s\S]*?version:\s*(.+)\n/);
      const version = versionMatch ? versionMatch[1].trim() : '1.0.0';
      knowledges.push({ name, path: mdPath, version });
    }
  } catch {
  }

  return knowledges;
}