export function formatSkill(skill: { name: string; description: string; downloadCount: number; license?: string }): string {
  const lines = [
    `\x1b[1m${skill.name}\x1b[0m`,
    `  ${skill.description}`,
    `  下载: ${skill.downloadCount}${skill.license ? ` | 许可: ${skill.license}` : ''}`,
  ];
  return lines.join('\n');
}

export function formatSkillDetail(skill: {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string[];
  fileSize: number;
  fileHash: string;
  downloadCount: number;
  publishedAt: string;
  metadata?: Record<string, string>;
}): string {
  const lines = [
    `\x1b[1m${skill.name}\x1b[0m`,
    '',
    `描述: ${skill.description}`,
    `文件大小: ${skill.fileSize} bytes`,
    `下载次数: ${skill.downloadCount}`,
    `发布时间: ${skill.publishedAt}`,
  ];

  if (skill.license) {
    lines.push(`许可: ${skill.license}`);
  }
  if (skill.compatibility) {
    lines.push(`兼容性: ${skill.compatibility}`);
  }
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    lines.push(`允许工具: ${skill.allowedTools.join(', ')}`);
  }
  if (skill.metadata) {
    lines.push(`元数据: ${JSON.stringify(skill.metadata)}`);
  }

  return lines.join('\n');
}

export function success(msg: string): void {
  console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
}

export function error(msg: string): void {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
}

export function info(msg: string): void {
  console.log(`\x1b[34mℹ ${msg}\x1b[0m`);
}

export function formatAgent(agent: {
  name: string;
  version: string;
  description: string;
  status: string;
  skillsCount?: number;
  knowledgesCount?: number;
}): string {
  const lines = [
    `\x1b[1m${agent.name}\x1b[0m`,
    `  ${agent.description}`,
    `  版本: ${agent.version} | 状态: ${agent.status}${agent.skillsCount !== undefined ? ` | Skills: ${agent.skillsCount}` : ''}${agent.knowledgesCount !== undefined ? ` | Knowledges: ${agent.knowledgesCount}` : ''}`,
  ];
  return lines.join('\n');
}

export function formatAgentDetail(agent: {
  name: string;
  version: string;
  description: string;
  status: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  skills?: Array<{
    skill: { name: string };
    config?: Record<string, unknown>;
  }>;
  knowledges?: Array<{
    knowledgeId: string;
    retrievalConfig?: { topK?: number; similarityThreshold?: number };
  }>;
}): string {
  const lines = [
    `\x1b[1m${agent.name}\x1b[0m`,
    '',
    `版本: ${agent.version}`,
    `描述: ${agent.description}`,
    `状态: ${agent.status}`,
    `创建时间: ${agent.createdAt}`,
    `更新时间: ${agent.updatedAt}`,
  ];

  if (agent.skills && agent.skills.length > 0) {
    lines.push('');
    lines.push('Skills:');
    for (const s of agent.skills) {
      lines.push(`  - ${s.skill.name}${s.config ? ` (config: ${JSON.stringify(s.config)})` : ''}`);
    }
  }

  if (agent.knowledges && agent.knowledges.length > 0) {
    lines.push('');
    lines.push('Knowledges:');
    for (const k of agent.knowledges) {
      lines.push(`  - ${k.knowledgeId}${k.retrievalConfig ? ` (topK: ${k.retrievalConfig.topK})` : ''}`);
    }
  }

  if (agent.prompt) {
    lines.push('');
    lines.push('System Prompt:');
    lines.push('---');
    lines.push(agent.prompt);
    lines.push('---');
  }

  return lines.join('\n');
}