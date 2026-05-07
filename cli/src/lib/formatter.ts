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
    knowledgeName?: string;
    retrievalConfig?: { topK?: number; similarityThreshold?: number };
  }>;
}): string {
  const lines = [
    `\x1b[1m${agent.name}\x1b[0m`,
    '',
    `版本: ${agent.version}`,
    `描述: ${agent.description || '暂无描述'}`,
    `状态: ${agent.status}`,
    `创建时间: ${formatTime(agent.createdAt)}`,
    `更新时间: ${formatTime(agent.updatedAt)}`,
  ];

  if (agent.skills && agent.skills.length > 0) {
    lines.push('');
    lines.push('Skills:');
    for (const s of agent.skills) {
      const hasConfig = s.config && Object.keys(s.config).length > 0;
      lines.push(`  - ${s.skill.name}${hasConfig ? ` (config: ${JSON.stringify(s.config)})` : ''}`);
    }
  }

  if (agent.knowledges && agent.knowledges.length > 0) {
    lines.push('');
    lines.push('Knowledges:');
    for (const k of agent.knowledges) {
      const name = k.knowledgeName || k.knowledgeId;
      const topK = k.retrievalConfig?.topK;
      lines.push(`  - ${name}${topK ? ` (topK: ${topK})` : ''}`);
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

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function formatKnowledge(knowledge: {
  name: string;
  description: string;
  type: string;
  size: number;
  downloadCount: number;
}): string {
  const sizeStr = knowledge.size > 1024 * 1024
    ? `${(knowledge.size / (1024 * 1024)).toFixed(2)} MB`
    : knowledge.size > 1024
      ? `${(knowledge.size / 1024).toFixed(2)} KB`
      : `${knowledge.size} B`;

  const lines = [
    `\x1b[1m${knowledge.name}\x1b[0m`,
    `  ${knowledge.description}`,
    `  类型: ${knowledge.type} | 大小: ${sizeStr} | 下载: ${knowledge.downloadCount}`,
  ];
  return lines.join('\n');
}

export function formatKnowledgeDetail(knowledge: {
  name: string;
  description: string;
  type: string;
  fileSize: number;
  fileHash: string;
  downloadCount: number;
  publishedAt: string;
  tags?: string[];
}): string {
  const sizeStr = knowledge.fileSize > 1024 * 1024
    ? `${(knowledge.fileSize / (1024 * 1024)).toFixed(2)} MB`
    : knowledge.fileSize > 1024
      ? `${(knowledge.fileSize / 1024).toFixed(2)} KB`
      : `${knowledge.fileSize} B`;

  const lines = [
    `\x1b[1m${knowledge.name}\x1b[0m`,
    '',
    `描述: ${knowledge.description}`,
    `类型: ${knowledge.type}`,
    `文件大小: ${sizeStr}`,
    `下载次数: ${knowledge.downloadCount}`,
    `发布时间: ${knowledge.publishedAt}`,
  ];

  if (knowledge.tags && knowledge.tags.length > 0) {
    lines.push(`标签: ${knowledge.tags.join(', ')}`);
  }

  return lines.join('\n');
}