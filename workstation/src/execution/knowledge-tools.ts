import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ArmClient } from "../arm-client/client.ts";

/**
 * 工作经验检索工具：按关键词检索全局知识库（ARM GET /knowledges?search=）。
 * 返回匹配条目的标题/描述/id，供 Agent 排障时定位历史经验。
 */
export function buildKnowledgeSearchTool(armClient: ArmClient): AgentTool<any> {
  return {
    name: "knowledge_search",
    label: "检索工作经验知识库",
    description:
      "按关键词检索「工作经验」知识库，返回匹配条目（标题、描述、id）。遇到报错、排查问题、需要历史经验时调用。",
    parameters: Type.Object({
      query: Type.String({ description: "检索关键词，例如报错信息或问题主题" }),
    }),
    execute: async (_toolCallId: string, params: unknown) => {
      const query = (params as { query?: string } | null | undefined)?.query ?? "";
      const res = await armClient.searchKnowledges({ keyword: query, pageSize: 10 });
      const items = (res?.knowledges ?? []) as Array<{ id: string; name: string; description?: string }>;
      const text =
        items.length === 0
          ? "未找到相关知识。"
          : items
              .map((k, i) => `${i + 1}. ${k.name}${k.description ? ` — ${k.description}` : ""} (id: ${k.id})`)
              .join("\n");
      return { content: [{ type: "text", text }], details: { count: items.length } };
    },
  } as AgentTool<any>;
}
