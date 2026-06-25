import { config } from "../config.ts";

/**
 * 直接调 OpenAI 兼容 /chat/completions 拿到一段非流式输出。
 *
 * 用场景：总结工作空间历史 → 生成 Knowledge 内容。
 * 不复用 pi-agent-core 是因为这里没有"工具/多轮"需求，一次性 chat/completions
 * 就够，且可避免额外的 system prompt 注入。
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** 超时毫秒，默认 60s */
  timeoutMs?: number;
}

export async function chatComplete(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  const url = `${config.llm.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = {
    model: opts.model ?? config.llm.defaultModel,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 4096,
    stream: false,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.llm.apiKey ? { Authorization: `Bearer ${config.llm.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const choice = json.choices?.[0];
    if (!choice) throw new Error("LLM 返回无 choices");
    return (choice.message?.content ?? "").trim();
  } finally {
    clearTimeout(timer);
  }
}
