import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppConfig {
  llm: {
    provider: string;
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
  };
  arm: {
    baseUrl: string;
    apiKey: string;
    ssoUrl: string;
  };
  server: {
    port: number;
    host: string;
  };
  db: {
    path: string;
  };
  armCliTool: {
    enabled: boolean;
    cliPath: string;
    timeoutMs: number;
  };
}

function loadConfigFile(): Partial<AppConfig> {
  const candidates = [
    resolve(process.cwd(), "config.yaml"),
    resolve(__dirname, "../../config.yaml"),
    resolve(__dirname, "../config.yaml"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return parseYaml(readFileSync(p, "utf8")) as Partial<AppConfig>;
    }
  }
  return {};
}

function env<T>(key: string, fallback?: T): T | string | undefined {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return v === "true" || v === "1" || v === "yes";
}

const file = loadConfigFile();

export const config: AppConfig = {
  llm: {
    provider: (env("WS_LLM_PROVIDER") as string) ?? file.llm?.provider ?? "openai",
    baseUrl: (env("WS_LLM_BASE_URL") as string) ?? file.llm?.baseUrl ?? "https://api.openai.com/v1",
    apiKey: (env("WS_LLM_API_KEY") as string) ?? file.llm?.apiKey ?? "",
    defaultModel:
      (env("WS_LLM_MODEL") as string) ?? file.llm?.defaultModel ?? "gpt-4o",
  },
  arm: {
    baseUrl: (env("WS_ARM_BASE_URL") as string) ?? file.arm?.baseUrl ?? "http://localhost:3000",
    apiKey: (env("WS_ARM_API_KEY") as string) ?? file.arm?.apiKey ?? "",
    ssoUrl: (env("WS_ARM_SSO_URL") as string) ?? process.env.NEXT_PUBLIC_SSO_URL ?? "http://sso.agent-platform.dev.aimstek.cn",
  },
  server: {
    port: num("WS_PORT", file.server?.port ?? 4000),
    host: (env("WS_HOST") as string) ?? file.server?.host ?? "0.0.0.0",
  },
  db: {
    path: (env("WS_DB_PATH") as string) ?? file.db?.path ?? "./data/workstation.db",
  },
  armCliTool: {
    enabled: bool("WS_ARM_CLI_ENABLED", file.armCliTool?.enabled ?? true),
    cliPath: (env("WS_ARM_CLI_PATH") as string) ?? file.armCliTool?.cliPath ?? "arm",
    timeoutMs: num("WS_ARM_CLI_TIMEOUT_MS", file.armCliTool?.timeoutMs ?? 60_000),
  },
};

export function ensureConfig(): void {
  const missing: string[] = [];
  if (!config.llm.apiKey) missing.push("llm.apiKey (WS_LLM_API_KEY)");
  if (missing.length) {
    console.warn(
      `[config] 缺少必填配置: ${missing.join(", ")}\n` +
        `可通过 config.yaml 或环境变量配置。`,
    );
  }
}