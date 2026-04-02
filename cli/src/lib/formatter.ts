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