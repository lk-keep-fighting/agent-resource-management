import type { AgentRunner } from "./agent-runner.ts";

/**
 * 活跃 Run 注册表 —— 让外部 abort 请求能找到真正在跑的 AgentRunner。
 *
 * 背景：每个 Run 是在 `POST /workspaces/:id/runs` 的请求 handler 里局部创建的，
 * AgentRunner 实例只存在于那个 handler 的闭包中。外部 `POST /runs/:id/abort`
 * 单独发请求时拿不到这个实例，所以 abort 路由原本只能更新 DB 状态。
 *
 * 解决：在 executeRun 开始时把 runner 放进这里，结束时删掉。
 *       abort 路由通过 runId 查到 runner，调 runner.abort()。
 */
const activeRunners = new Map<string, AgentRunner>();

export function registerRunner(runId: string, runner: AgentRunner): void {
  activeRunners.set(runId, runner);
}

export function unregisterRunner(runId: string): void {
  activeRunners.delete(runId);
}

export function getRunner(runId: string): AgentRunner | undefined {
  return activeRunners.get(runId);
}

export function listActiveRunIds(): string[] {
  return Array.from(activeRunners.keys());
}
