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
import type { ArmClient } from "../arm-client/client.ts";
import type { ArmAgentDetail, WsRun, WsMessage } from "../types.ts";
import { buildSystemPrompt } from "./context-builder.ts";
import { buildSkillHintTool } from "./skill-tools.ts";
import { prepareEssentialKnowledges } from "./knowledge-env.ts";
import { resolvePinnedExperience } from "./knowledge-env.ts";
import { buildKnowledgeSearchTool } from "./knowledge-tools.ts";
import { registerRunner, unregisterRunner } from "./runner-registry.ts";

type SseSender = (event: string, data: unknown) => void;

interface RunOptions {
  run: WsRun;
  userMessage: string;
  sender: SseSender;
  abortSignal?: AbortSignal;
  /**
   * 历史消息加载模式：
   * - 'continue' (续接已存在 run)：用该 run 自己的消息历史
   * - 'fresh'    (新建 run)         ：用 workspace 全部历史消息
   *
   * 决定传给 Agent 的 initialState.messages
   */
  historyMode: "continue" | "fresh";
  pinnedExperienceIds?: string[];
  /** 由 route handler 通过 armForContext(c) 构造；execution 内部统一用这个实例 */
  armClient: ArmClient;
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
 * 把 ws_message 转换为 pi-agent-core 期望的 AgentMessage[]（用于连续对话）。
 *
 * 当前只重建 user / assistant 纯文本消息：
 * - user: { role: "user", content, timestamp }
 * - assistant: { role: "assistant", content: [{type:"text", text}], api, provider, model, usage, stopReason, timestamp }
 *
 * 工具调用历史暂不传（ws_message 没存 assistant 消息的 tool_calls 字段），
 * 后续可扩展：ws_message 加 tool_calls_json 列 + tool 消息保留调用上下文。
 */
function buildMessageHistory(
  messages: WsMessage[],
  model: Model<"openai-completions">,
): any[] {
  const result: any[] = [];
  let ts = Date.now() - messages.length * 1000; // 兜底时间戳（按消息顺序递增）
  for (const m of messages) {
    ts += 1000;
    if (m.role === "user") {
      const text = m.content ?? "";
      if (!text) continue;
      result.push({
        role: "user",
        content: text,
        timestamp: m.createdAt ?? ts,
      });
    } else if (m.role === "assistant") {
      const text = m.content ?? "";
      if (!text) continue;
      result.push({
        role: "assistant",
        content: [{ type: "text", text }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
        stopReason: "stop",
        timestamp: m.createdAt ?? ts,
      });
    }
    // role='tool' 暂不传（缺 tool_calls 上下文）
  }
  return result;
}

/**
 * 单次 Run 编排：拉 Agent、组装 prompt、建 Agent 实例、跑用户消息。
 */
export async function executeRun(opts: RunOptions): Promise<ExecuteResult> {
  const { run, userMessage, sender, armClient } = opts;

  workspaceRepo.touch(run.workspaceId);

  const agentDetail = await armClient.getAgent(run.agentId);
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
  const cwd = workspace?.cwd ?? workspaceCwdPath(run.workspaceId);

  // 按 kind 分流知识：essential 下载/内联；experience 仅提示 + 检索工具
  const essentialBindings = (agentDetail.knowledgeBindings ?? [])
    .filter((b) => (b.kind ?? "experience") === "essential")
    .map((b) => ({ knowledgeId: b.knowledgeId, knowledgeName: b.knowledgeName, version: b.version }));

  let essentialFiles: Awaited<ReturnType<typeof prepareEssentialKnowledges>>["files"] | undefined;
  let essentialInline: Awaited<ReturnType<typeof prepareEssentialKnowledges>>["inline"] | undefined;
  let essentialErrors: string[] | undefined;
  if (essentialBindings.length) {
    const r = await prepareEssentialKnowledges(essentialBindings, cwd, enableTools, armClient);
    essentialFiles = r.files.length ? r.files : undefined;
    essentialInline = r.inline.length ? r.inline : undefined;
    essentialErrors = r.errors.length ? r.errors : undefined;
  }

  let pinnedExperience: Array<{ name: string; content: string }> | undefined;
  let pinnedErrors: string[] | undefined;
  if (opts.pinnedExperienceIds?.length) {
    const r = await resolvePinnedExperience(opts.pinnedExperienceIds, armClient);
    pinnedExperience = r.items.length ? r.items : undefined;
    pinnedErrors = r.errors.length ? r.errors : undefined;
  }

  // 有引用经验时必须绕过 run.systemPrompt 快照（runs.ts 在 executeRun 前已写入快照），
  // 否则引用内容会被静默丢弃；无引用时保留快照优先的既有语义。
  const promptOpts = { enableTools, cwd, essentialFiles, essentialInline, essentialErrors };
  const systemPrompt = opts.pinnedExperienceIds?.length
    ? buildSystemPrompt(agentDetail, null, { ...promptOpts, pinnedExperience, pinnedErrors })
    : (run.systemPrompt || buildSystemPrompt(agentDetail, null, promptOpts));

  const tools: any[] = [];
  if (enableTools) {
    // pi-coding-agent 内置 7 件套：bash / read / write / edit / ls / grep / find
    tools.push(...buildTools(cwd));
    // 提示当前 WS 已绑定的 Skill 列表（仅 info 工具，无副作用）
    const skillSummaries = (agentDetail.skillBindings ?? []).map((b) => ({
      name: b.skillName ?? b.skillId,
      version: b.version,
      description: undefined,
    }));
    const skillHint = buildSkillHintTool(skillSummaries);
    if (skillHint) tools.push(skillHint);
    // 工作经验检索工具（按需检索全局知识库，排障时使用）
    tools.push(buildKnowledgeSearchTool(armClient));
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

  // 加载历史消息（连续对话）
  // - 'continue' (POST /runs/:id/messages 续接该 run)：用该 run 的所有 user/assistant
  // - 'fresh'    (POST /workspaces/:workspaceId/runs 新建)：用 workspace 全部历史
  const historyMessages = (() => {
    if (opts.historyMode === "continue") {
      // 续接：用该 run 自己的消息（不含当前 userMessage，它会通过 agent.prompt() 追加）
      return buildMessageHistory(messageRepo.listByRun(run.id), model);
    }
    // 新建：用 workspace 全部历史
    return buildMessageHistory(messageRepo.listByWorkspace(run.workspaceId), model);
  })();

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      tools,
      messages: historyMessages,
    },
    getApiKey: async () => config.llm.apiKey,
  });

  const runner = new AgentRunner(agent, run, sender);
  registerRunner(run.id, runner);

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
  } finally {
    unregisterRunner(run.id);
  }
}