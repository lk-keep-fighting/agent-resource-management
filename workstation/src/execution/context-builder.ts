import type { ArmAgentDetail } from "../types.ts";

interface BuildOptions {
  enableTools?: boolean;
  cwd?: string | null;
}

/**
 * 三层 systemPrompt 组装：
 * Layer 1: ARM Agent.prompt（身份层）
 * Layer 2: Workspace.context（场景层，追加）
 * Layer 3: 已绑定资源摘要 + 工具行为指引（运行时提示）
 */
export function buildSystemPrompt(
  agent: ArmAgentDetail,
  workspaceContext: string | null,
  options: BuildOptions = {},
): string {
  const { enableTools = false, cwd = null } = options;
  const parts: string[] = [];
  parts.push(agent.prompt || "你是一名 AI 助手。");

  if (workspaceContext && workspaceContext.trim()) {
    parts.push(`\n## 当前工作场景\n${workspaceContext.trim()}`);
  }

  const skillHints = (agent.skillBindings ?? []).map(
    (b) =>
      `- Skill: ${b.skillName ?? b.skillId} (v${b.version})${
        b.config ? ` config=${JSON.stringify(b.config)}` : ""
      }`,
  );
  const knowledgeHints = (agent.knowledgeBindings ?? []).map(
    (b) =>
      `- Knowledge: ${b.knowledgeName ?? b.knowledgeId} (v${b.version})${
        b.retrievalConfig ? ` retrieval=${JSON.stringify(b.retrievalConfig)}` : ""
      }`,
  );

  if (skillHints.length || knowledgeHints.length) {
    parts.push(`\n## 已加载资源`);
    if (skillHints.length) parts.push(`\n### Skills\n${skillHints.join("\n")}`);
    if (knowledgeHints.length)
      parts.push(`\n### Knowledges\n${knowledgeHints.join("\n")}`);
  }

  if (enableTools) {
    parts.push(`\n## 工作能力`);
    parts.push(
      `\n你可以使用工具直接执行命令和读写文件。**请务必亲自调用工具完成任务，不要只把命令写出来让用户自己跑**。`,
    );
    if (cwd) {
      parts.push(`\n当前工作目录: \`${cwd}\` —— 所有 bash/read/write/edit 都在该目录下进行。`);
    }
    parts.push(
      `\n可用的工具：bash（执行 shell 命令）、read（读文件）、write（写文件）、edit（编辑文件）、ls/grep/find（浏览与搜索）。`,
    );
  }

  return parts.join("\n");
}