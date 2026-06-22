import { Type } from "typebox";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../../config.ts";

const exec = promisify(execFile);

export const armCliTool = {
  name: "arm_cli",
  label: "ARM CLI",
  description: [
    "通过 ARM CLI 命令行查询与操作 ARM 资源（Agent、Skill、Knowledge）。",
    "可执行常用命令：",
    "  arm skill ls                        - 列出所有 skill",
    "  arm skill info <name>              - 查看 skill 详情",
    "  arm skill search <keyword>         - 搜索 skill",
    "  arm skill download <name>          - 下载 skill 到本地 ~/.arm/skills/<name>",
    "  arm knowledge ls                   - 列出所有 knowledge",
    "  arm knowledge info <name>          - 查看 knowledge 详情",
    "  arm knowledge search <keyword>     - 搜索 knowledge",
    "  arm agent ls                       - 列出所有 agent",
    "  arm agent info <name>              - 查看 agent 详情",
    "传 subcommand（不含 'arm' 前缀）。",
  ].join("\n"),
  parameters: Type.Object({
    subcommand: Type.String({
      description: "完整的 arm 子命令（不含 'arm' 前缀），例如 'skill info log-parser'",
    }),
  }),
  execute: async (
    _toolCallId: string,
    params: { subcommand: string },
    signal?: AbortSignal,
  ) => {
    const args = params.subcommand.trim().split(/\s+/).filter(Boolean);
    if (args.length === 0) {
      return {
        content: [{ type: "text", text: "[error] subcommand 不能为空" }],
        details: { exitCode: 1 },
      };
    }
    try {
      const { stdout, stderr } = await exec(config.armCliTool.cliPath, args, {
        timeout: config.armCliTool.timeoutMs,
        signal,
        maxBuffer: 10 * 1024 * 1024,
      });
      const parts: Array<{ type: "text"; text: string }> = [
        { type: "text", text: stdout || "(无 stdout)" },
      ];
      if (stderr && stderr.trim()) {
        parts.push({ type: "text", text: `[stderr]\n${stderr}` });
      }
      return { content: parts, details: { exitCode: 0, command: args.join(" ") } };
    } catch (e: any) {
      const msg = e?.killed
        ? `[error] 命令超时或被取消`
        : `[error] ${e.message}\n${e.stderr || ""}`;
      return {
        content: [{ type: "text", text: msg }],
        details: { exitCode: e.code ?? 1, command: args.join(" ") },
      };
    }
  },
};