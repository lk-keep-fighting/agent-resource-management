import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ArmClient } from "../arm-client/client.ts";

/** 与 backend agents/[id]/download/route.ts 的 sanitizeFilename 保持一致。 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9一-龥_-]/g, "_");
}

export interface EssentialEntry { name: string; filename: string; }
export interface EssentialInline { name: string; content: string; }
export interface EssentialResult {
  files: EssentialEntry[];      // enableTools=true：已写成文件的
  inline: EssentialInline[];    // enableTools=false：待内联进 prompt 的
  errors: string[];             // 加载失败的名称
}

interface EssentialBinding {
  knowledgeId: string;
  knowledgeName?: string;
  version: string;
}

// 进程内缓存：同 ${knowledgeId}:${version} 的 content 不重复拉取。
const contentCache = new Map<string, string>();
export function __resetEssentialCacheForTests(): void {
  contentCache.clear();
}

/**
 * 准备 essential（必备业务知识）：
 * - enableTools=true：写到 <cwd>/knowledges/<sanitize>.md
 * - enableTools=false：返回 inline 内容由 system prompt 内联
 * 拉取失败（返回 null）记入 errors，不中断。
 */
export async function prepareEssentialKnowledges(
  bindings: EssentialBinding[],
  cwd: string,
  enableTools: boolean,
  armClient: ArmClient,
): Promise<EssentialResult> {
  const files: EssentialEntry[] = [];
  const inline: EssentialInline[] = [];
  const errors: string[] = [];

  if (enableTools && bindings.length) {
    mkdirSync(join(cwd, "knowledges"), { recursive: true });
  }

  for (const b of bindings) {
    const name = b.knowledgeName ?? b.knowledgeId;
    const cacheKey = `${b.knowledgeId}:${b.version}`;
    let content = contentCache.get(cacheKey);
    if (content === undefined) {
      const k = await armClient.getKnowledgeById(b.knowledgeId);
      if (!k) { errors.push(name); continue; }
      const fetched: string = k.content ?? "";
      content = fetched;
      contentCache.set(cacheKey, fetched);
    }
    const body = content || `# ${name}\n\n（内容为空）`;
    if (enableTools) {
      const filename = `${sanitizeFilename(name)}.md`;
      writeFileSync(join(cwd, "knowledges", filename), body, "utf-8");
      files.push({ name, filename });
    } else {
      inline.push({ name, content: body });
    }
  }
  return { files, inline, errors };
}

export interface PinnedItem {
  name: string;
  content: string;
}
export interface PinnedResult {
  items: PinnedItem[];
  errors: string[];
}

/**
 * 解析用户本轮引用的经验：按 id 取全文，去重；取不到的进 errors。
 * 引用即用即弃（≤5 条/轮），不复用 essential 缓存。
 */
export async function resolvePinnedExperience(
  ids: string[],
  armClient: ArmClient,
): Promise<PinnedResult> {
  const items: PinnedItem[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const k = await armClient.getKnowledgeById(id);
    if (!k) {
      errors.push(id);
      continue;
    }
    items.push({ name: k.name ?? id, content: k.content ?? "" });
  }
  return { items, errors };
}
