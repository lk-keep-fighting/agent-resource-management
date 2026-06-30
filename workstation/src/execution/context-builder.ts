import type { ArmAgentDetail } from "../types.ts";

interface BuildOptions {
  enableTools?: boolean;
  cwd?: string | null;
  essentialFiles?: Array<{ name: string; filename: string }>;
  essentialInline?: Array<{ name: string; content: string }>;
  essentialErrors?: string[];
  pinnedExperience?: Array<{ name: string; content: string }>;
  pinnedErrors?: string[];
}

/**
 * 三层 systemPrompt 组装：
 * Layer 1: ARM Agent.prompt（身份层）
 * Layer 2: Workspace.context（场景层，追加）
 * Layer 3: 已加载资源（Skills + 必备业务知识 / 工作经验）+ 工具行为指引
 *
 * 知识按绑定维度 kind 分流：
 * - essential（必备业务知识）：enableTools 时已下载到 knowledges/；否则内联进 prompt
 * - experience（工作经验）：不进上下文，按需用 knowledge_search 工具检索
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

  // ── Layer 3：资源 ──
  const skillHints = (agent.skillBindings ?? []).map(
    (b) => `- ${b.skillName ?? b.skillId} (v${b.version})${b.config ? ` config=${JSON.stringify(b.config)}` : ""}`,
  );
  const experienceBindings = (agent.knowledgeBindings ?? []).filter(
    (b) => (b.kind ?? "experience") === "experience",
  );

  const hasEssential =
    !!options.essentialFiles?.length ||
    !!options.essentialInline?.length ||
    !!options.essentialErrors?.length;
  const hasExperience = experienceBindings.length > 0;

  if (skillHints.length || hasEssential || hasExperience) {
    parts.push(`\n## 已加载资源`);
    if (skillHints.length) parts.push(`\n### Skills\n${skillHints.join("\n")}`);

    if (options.essentialFiles?.length) {
      parts.push(`\n### 必备业务知识（已下载到 knowledges/，开工前请查阅）`);
      parts.push(options.essentialFiles.map((f) => `- ${f.name} → knowledges/${f.filename}`).join("\n"));
    } else if (options.essentialInline?.length) {
      parts.push(`\n### 必备业务知识`);
      for (const k of options.essentialInline) {
        parts.push(`\n#### ${k.name}\n${k.content}`);
      }
    }
    if (options.essentialErrors?.length) {
      parts.push(`\n> 部分必备知识加载失败：${options.essentialErrors.join(", ")}`);
    }

    if (hasExperience) {
      const names = experienceBindings.map((b) => b.knowledgeName ?? b.knowledgeId);
      parts.push(`\n### 工作经验（按需检索，不占用上下文）`);
      if (names.length <= 8) {
        parts.push(
          `可使用 knowledge_search 工具按关键词检索，或直接查阅：\n${names.map((n) => `- ${n}`).join("\n")}`,
        );
      } else {
        parts.push(`共 ${names.length} 条工作经验，请使用 knowledge_search 工具按关键词检索。`);
      }
    }
  }

  // ── 工具能力 ──
  if (enableTools) {
    parts.push(`\n## 工作能力`);
    parts.push(`\n你可以使用工具直接执行命令和读写文件。**请务必亲自调用工具完成任务，不要只把命令写出来让用户自己跑**。`);
    if (cwd) parts.push(`\n当前工作目录: \`${cwd}\` —— 所有 bash/read/write/edit 都在该目录下进行。`);
    parts.push(
      `\n可用工具：bash、read、write、edit、ls/grep/find、knowledge_search（按关键词检索全局「工作经验」知识库，排障时使用）。`,
    );
  }

  if (options.pinnedExperience?.length) {
    parts.push(`\n### 用户本次引用的工作经验`);
    for (const k of options.pinnedExperience) {
      parts.push(`\n#### ${k.name}\n${k.content}`);
    }
  }
  if (options.pinnedErrors?.length) {
    parts.push(`\n> 部分引用经验加载失败：${options.pinnedErrors.join(", ")}`);
  }

  return parts.join("\n");
}
