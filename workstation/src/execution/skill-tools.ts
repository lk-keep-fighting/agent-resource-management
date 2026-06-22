import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";

/**
 * 按 ARM 的 Skill 绑定，构造轻量级"skill 引用"工具。
 * 实际加载/调用通过 arm_cli 工具完成（agent 自己调用 arm skill info/download）。
 *
 * 保留此 tool 占位符的目的：让 Agent 知道当前绑定了哪些 Skill（描述里列出）。
 */
export function buildSkillHintTool(
  skillSummaries: Array<{ name: string; version?: string; description?: string }>,
): AgentTool<any> | null {
  if (skillSummaries.length === 0) return null;
  return {
    name: "available_skills",
    label: "已绑定的 Skill 列表",
    description:
      `当前 Agent 已绑定以下 Skill，可通过 arm_cli 工具（如 arm skill info <name>、arm skill download <name>）加载并使用：\n\n` +
      skillSummaries
        .map((s) => `- ${s.name}${s.version ? ` (v${s.version})` : ""}${s.description ? `: ${s.description}` : ""}`)
        .join("\n"),
    parameters: Type.Object({}),
    execute: async () => ({
      content: [
        {
          type: "text",
          text:
            "已绑定 Skill 列表见 description。需要查看/使用时，请用 arm_cli 工具执行 'skill info <name>' 或 'skill download <name>'。",
        },
      ],
      details: {},
    }),
  } as AgentTool<any>;
}