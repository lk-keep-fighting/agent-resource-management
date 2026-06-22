import { Agent } from "@earendil-works/pi-agent-core";
import { registerApiProvider, type Model } from "@earendil-works/pi-ai";
import {
  streamOpenAICompletions,
  streamSimpleOpenAICompletions,
} from "@earendil-works/pi-ai/openai-completions";
import { config } from "../config.ts";
import { buildTools, workspaceCwdPath } from "./built-in-tools.ts";

// ─────────── 注册 OpenAI Completions Provider ───────────
// 内置 openai provider 现在用 openai-responses API（路径 /responses），
// 与 OpenAI 兼容的第三方（智谱 GLM / DeepSeek 等）走 /chat/completions，
// 所以注册一个独立的 openai-completions provider。
let _providerRegistered = false;
function ensureProviderRegistered(): void {
  if (_providerRegistered) return;
  registerApiProvider(
    {
      api: "openai-completions",
      stream: streamOpenAICompletions,
      streamSimple: streamSimpleOpenAICompletions,
    },
    "ws-openai-completions",
  );
  _providerRegistered = true;
}

function buildModel(): Model<"openai-completions"> {
  ensureProviderRegistered();
  return {
    id: config.llm.defaultModel,
    name: config.llm.defaultModel,
    api: "openai-completions",
    provider: config.llm.provider,
    baseUrl: config.llm.baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 16_384,
  };
}
import { messageRepo } from "../db/repos/message.repo.ts";
import { eventRepo } from "../db/repos/event.repo.ts";
import { runRepo } from "../db/repos/run.repo.ts";
import { workspaceRepo } from "../db/repos/workspace.repo.ts";
import { arm } from "../arm-client/client.ts";
import type { ArmAgentDetail, WsRun } from "../types.ts";
import { buildSystemPrompt } from "./context-builder.ts";
import { armCliTool } from "./tools/arm-cli.ts";
import { buildSkillHintTool } from "./skill-tools.ts";

type SseSender = (event: string, data: unknown) => void;

interface RunOptions {
  run: WsRun;
  userMessage: string;
  sender: SseSender;
  abortSignal?: AbortSignal;
}

interface ExecuteResult {
  status: "completed" | "failed" | "aborted";
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
  ttftMs?: number;
  toolCallCount?: number;
  error?: string;
}

export class AgentRunner {
  private agent: Agent;
  private run: WsRun;
  private sender: SseSender;
  private abortController: AbortController;
  private toolCallCount = 0;
  private firstDeltaAt: number | null = null;
  private startedAt = Date.now();

  constructor(agent: Agent, run: WsRun, sender: SseSender) {
    this.agent = agent;
    this.run = run;
    this.sender = sender;
    this.abortController = new AbortController();
    agent.subscribe(async (event) => {
      try {
        await this.handleEvent(event);
      } catch (e) {
        console.error("[runner] event handler error", e);
      }
    });
  }

  abort(): void {
    this.abortController.abort();
    this.agent.abort();
  }

  private async handleEvent(event: any): Promise<void> {
    const seq = eventRepo.nextSeq(this.run.id);

    switch (event.type) {
      case "agent_start":
        this.startedAt = Date.now();
        runRepo.updateStatus(this.run.id, "loading");
        this.emit("run.start", { runId: this.run.id, agentId: this.run.agentId });
        this.emitAndStore(seq, "agent_start", {});
        break;

      case "turn_start":
        runRepo.updateStatus(this.run.id, "streaming");
        break;

      case "message_start": {
        const m = event.message;
        if (!m) break;
        if (m.role === "user") {
          messageRepo.append({
            runId: this.run.id,
            role: "user",
            content: this.extractText(m.content),
            seq: m.seq ?? undefined,
          });
          this.emit("message.user", {
            seq: m.seq,
            content: this.extractText(m.content),
          });
        } else if (m.role === "assistant") {
          runRepo.updateStatus(this.run.id, "streaming");
        } else if (m.role === "toolResult") {
          messageRepo.upsertByToolCall(
            this.run.id,
            m.toolCallId ?? "",
            "tool",
            this.extractText(m.content),
          );
        }
        break;
      }

      case "message_update": {
        const am = event.assistantMessageEvent;
        if (am?.type === "text_delta" && typeof am.delta === "string") {
          if (this.firstDeltaAt === null) {
            this.firstDeltaAt = Date.now();
            const ttft = this.firstDeltaAt - this.startedAt;
            runRepo.recordMetrics(this.run.id, { ttftMs: ttft });
          }
          this.emit("message.delta", { delta: am.delta });
        }
        break;
      }

      case "message_end": {
        const m = event.message;
        if (m?.role === "assistant") {
          const text = this.extractText(m.content);
          if (text) {
            messageRepo.append({
              runId: this.run.id,
              role: "assistant",
              content: text,
            });
          }
          const usage = m.usage ?? {};
          runRepo.recordMetrics(this.run.id, {
            promptTokens: usage.inputTokens ?? usage.promptTokens,
            completionTokens: usage.outputTokens ?? usage.completionTokens,
          });
          this.emit("message.done", {
            finishReason: m.stopReason ?? "stop",
            usage,
          });
        }
        break;
      }

      case "tool_execution_start": {
        this.toolCallCount += 1;
        runRepo.updateStatus(this.run.id, "tool_calling");
        runRepo.recordMetrics(this.run.id, { toolCallCount: this.toolCallCount });
        const payload = {
          toolCallId: event.toolCallId,
          toolName: event.toolCall?.name ?? event.toolName,
          args: event.toolCall?.arguments ?? event.args,
        };
        this.emit("tool.call.start", payload);
        this.emitAndStore(seq, "tool_call_start", payload);
        break;
      }

      case "tool_execution_end": {
        const payload = {
          toolCallId: event.toolCallId,
          toolName: event.toolCall?.name ?? event.toolName,
          result: event.result,
          isError: event.isError,
        };
        this.emit("tool.call.end", payload);
        this.emitAndStore(seq, "tool_call_end", payload);
        if (event.isError) {
          this.emitAndStore(seq, "error", {
            toolName: event.toolCall?.name,
            message: typeof event.result === "string" ? event.result : JSON.stringify(event.result),
          });
        }
        break;
      }

      case "turn_end":
      case "agent_end":
        // 累计的 token 信息在 message_end 里；此处只更新 toolCallCount
        runRepo.recordMetrics(this.run.id, { toolCallCount: this.toolCallCount });
        break;

      case "error":
        this.emit("error", { message: event.error?.message ?? String(event.error) });
        this.emitAndStore(seq, "error", { message: event.error?.message ?? String(event.error) });
        break;
    }
  }

  private emitAndStore(seq: number, type: string, payload: Record<string, unknown>): void {
    eventRepo.append({ runId: this.run.id, type, payload, seq });
  }

  private emit(event: string, data: unknown): void {
    try {
      this.sender(event, data);
    } catch (e) {
      console.error("[runner] sse send error", e);
    }
  }

  private extractText(content: any): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((p) => (typeof p === "string" ? p : p?.text ?? ""))
        .filter(Boolean)
        .join("");
    }
    return "";
  }
}

/**
 * 单次 Run 编排：拉 Agent、组装 prompt、建 Agent 实例、跑用户消息。
 */
export async function executeRun(opts: RunOptions): Promise<ExecuteResult> {
  const { run, userMessage, sender } = opts;

  workspaceRepo.touch(run.workspaceId);

  const agentDetail = await arm().getAgent(run.agentId);
  if (!agentDetail) {
    const msg = `无法加载 Agent ${run.agentId}`;
    runRepo.updateStatus(run.id, "failed");
    sender("run.done", { status: "failed", error: msg });
    return { status: "failed", error: msg };
  }

  // 默认不注册任何工具 —— Workspace 需要工具时显式打开 enableTools。
  // 这样普通对话不会被工具抢戏。
  const workspace = workspaceRepo.get(run.workspaceId);
  const enableTools = workspace?.enableTools ?? false;

  const systemPrompt =
    run.systemPrompt ||
    buildSystemPrompt(agentDetail, null, {
      enableTools,
      cwd: workspace?.cwd ?? workspaceCwdPath(run.workspaceId),
    });

  const tools: any[] = [];
  if (enableTools) {
    // pi-coding-agent 内置 7 件套：bash / read / write / edit / ls / grep / find
    const cwd = workspace?.cwd ?? workspaceCwdPath(run.workspaceId);
    tools.push(...buildTools(cwd));
    // arm_cli 工具（与 bash 并存，用于查 ARM 资源）
    tools.push(armCliTool as any);
    // 提示当前 WS 已绑定的 Skill 列表（仅 info 工具，无副作用）
    const skillSummaries = (agentDetail.skillBindings ?? []).map((b) => ({
      name: b.skillName ?? b.skillId,
      version: b.version,
      description: undefined,
    }));
    const skillHint = buildSkillHintTool(skillSummaries);
    if (skillHint) tools.push(skillHint);
  }

  let model: Model<"openai-completions">;
  try {
    model = buildModel();
  } catch (e: any) {
    const msg = `初始化模型失败: ${e.message}`;
    runRepo.updateStatus(run.id, "failed");
    sender("run.done", { status: "failed", error: msg });
    return { status: "failed", error: msg };
  }

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      tools,
      messages: [],
    },
    getApiKey: async () => config.llm.apiKey,
  });

  const runner = new AgentRunner(agent, run, sender);

  try {
    sender("context.loaded", {
      agent: {
        id: agentDetail.id,
        name: agentDetail.name,
        version: agentDetail.version,
      },
      skillBindings: agentDetail.skillBindings ?? [],
      knowledgeBindings: agentDetail.knowledgeBindings ?? [],
    });

    await agent.prompt(userMessage);

    const durationMs = Date.now() - runner["startedAt"];
    runRepo.updateStatus(run.id, "completed");
    runRepo.recordMetrics(run.id, {
      durationMs,
      ttftMs: runner["firstDeltaAt"] ? runner["firstDeltaAt"] - runner["startedAt"] : null,
      toolCallCount: runner["toolCallCount"],
    });

    // 自动给 Run 起标题（取首条 user 消息前 50 字符）
    const messages = messageRepo.listByRun(run.id);
    if (!run.title) {
      const firstUser = messages.find((m) => m.role === "user");
      if (firstUser?.content) {
        const t = firstUser.content.trim().slice(0, 50);
        runRepo.updateTitle(run.id, t);
      }
    }

    sender("run.done", { status: "completed", durationMs });
    return { status: "completed", durationMs };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const aborted = msg.includes("aborted") || msg.includes("abort");
    const status = aborted ? "aborted" : "failed";
    runRepo.updateStatus(run.id, status);
    sender("run.done", { status, error: msg });
    return { status, error: msg };
  }
}