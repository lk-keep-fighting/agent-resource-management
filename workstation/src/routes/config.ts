import { Hono } from "hono";
import { configRepo } from "../db/repos/config.repo.ts";
import { config as appConfig } from "../config.ts";
import { ok } from "../utils/response.ts";

export const configRoute = new Hono();

const SAFE_KEYS = ["arm_base_url", "default_model", "arm_cli_enabled"];

configRoute.get("/", (c) => {
  const stored = configRepo.all();
  const merged: Record<string, unknown> = {
    llm: {
      provider: appConfig.llm.provider,
      baseUrl: stored.arm_base_url || appConfig.llm.baseUrl,
      defaultModel: stored.default_model || appConfig.llm.defaultModel,
      apiKeyMasked: appConfig.llm.apiKey ? `${appConfig.llm.apiKey.slice(0, 4)}***` : "",
    },
    arm: {
      baseUrl: appConfig.arm.baseUrl,
    },
    server: appConfig.server,
    armCliTool: {
      enabled: appConfig.armCliTool.enabled,
      cliPath: appConfig.armCliTool.cliPath,
      timeoutMs: appConfig.armCliTool.timeoutMs,
    },
  };
  return c.json(ok(merged));
});

configRoute.put("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, string>;
  for (const k of SAFE_KEYS) {
    if (typeof body[k] === "string") configRepo.set(k, body[k]);
  }
  return c.json(ok({ updated: Object.keys(body).filter((k) => SAFE_KEYS.includes(k)) }));
});