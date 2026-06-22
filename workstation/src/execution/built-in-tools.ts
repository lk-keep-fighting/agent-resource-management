import {
  createBashTool,
  createReadTool,
  createWriteTool,
  createEditTool,
  createLsTool,
  createGrepTool,
  createFindTool,
  createLocalBashOperations,
} from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";

/**
 * 给某个 Workspace 构造工具集。
 *
 * - enableTools=false：返回 []，纯对话
 * - enableTools=true：注册 pi-coding-agent 的 7 件套 (bash/read/write/edit/ls/grep/find)，
 *                     cwd = workspace.cwd（每个 WS 独立工作目录）
 *
 * 7 件套的工作目录限制在 ws.cwd 内（v3 决策 #8：不用沙箱；
 * 但通过独立目录 + 后续可加路径白名单来降低风险）。
 */
export function buildTools(workspaceCwd: string): AgentTool<any>[] {
  if (!existsSync(workspaceCwd)) {
    mkdirSync(workspaceCwd, { recursive: true });
  }
  const cwd = resolve(workspaceCwd);
  const bashOps = createLocalBashOperations();

  return [
    createBashTool(cwd, { operations: bashOps }),
    createReadTool(cwd),
    createWriteTool(cwd),
    createEditTool(cwd),
    createLsTool(cwd),
    createGrepTool(cwd),
    createFindTool(cwd),
  ];
}

/**
 * Workspace 的工作目录（绝对路径）。每个 WS 一个。
 */
export function workspaceCwdPath(workspaceId: string): string {
  return resolve(process.cwd(), "data", "workspaces", workspaceId);
}