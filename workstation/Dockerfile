# ──────────────────────────────────────────────────────────
# Agent Workstation Dockerfile
#
# 镜像：基于内网 nexus oven/bun 镜像
# 入口：bun src/server.ts
# 健康：GET /health
# 数据：/app/data（挂载卷持久化）
# ──────────────────────────────────────────────────────────

# ───── Stage 1: prepare ─────
# 准备依赖 + 类型检查（合并 deps 和 build，避免分阶段 COPY 找不到文件）
FROM nexus.aimstek.cn/xuanwu-factory/common/bun:1.2 AS prepare
WORKDIR /app

# 一次性复制整个 build context（.dockerignore 已排除 node_modules/data/.env 等）
COPY . .

# 装全量依赖（含 dev 用于 typecheck）
# 不加 --frozen-lockfile：CI build context 可能不含 bun.lock
RUN bun install

# 类型检查（CI 失败则 build 失败）
RUN bun run typecheck

# ───── Stage 2: runtime ─────
# 精简运行镜像
FROM nexus.aimstek.cn/xuanwu-factory/common/bun:1.2-slim AS runtime
WORKDIR /app

# 系统工具（健康检查用 wget + curl）
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget tini \
    && rm -rf /var/lib/apt/lists/*

# 从 prepare 阶段复制需要的产物
COPY --chown=bun:bun --from=prepare /app/node_modules /app/node_modules
COPY --chown=bun:bun --from=prepare /app/src /app/src
COPY --chown=bun:bun --from=prepare /app/public /app/public
COPY --chown=bun:bun --from=prepare /app/package.json /app/package.json

# 数据目录（运行时挂卷或本地持久化）
RUN mkdir -p /app/data && chown -R bun:bun /app/data

USER bun

# 环境变量默认值
ENV NODE_ENV=production \
    BUN_ENV=production \
    WS_HOST=0.0.0.0 \
    WS_PORT=4000 \
    WS_DB_PATH=/app/data/workstation.db \
    WS_LLM_PROVIDER=openai \
    WS_LLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4 \
    WS_LLM_MODEL=glm-4.5 \
    WS_ARM_CLI_ENABLED=true \
    WS_ARM_CLI_PATH=arm \
    WS_ARM_CLI_TIMEOUT_MS=60000

EXPOSE 4000

# tini 负责僵尸进程回收 + 信号转发
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${WS_PORT}/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "bun"]
CMD ["src/server.ts"]
