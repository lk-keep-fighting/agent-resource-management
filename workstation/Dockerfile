# ──────────────────────────────────────────────────────────
# Agent Workstation Dockerfile
#
# 镜像：基于 oven/bun:1（官方 Bun 镜像）
# 入口：bun src/server.ts
# 健康：GET /health
# 数据：/app/data（挂载卷持久化）
# ──────────────────────────────────────────────────────────

# ───── Stage 1: deps ─────
# 单独缓存依赖层（lockfile 变化才重装）
# 用 oven/bun:1.2+ 支持 lockfile v1（与项目 Bun 1.3+ 对齐）
FROM nexus.aimstek.cn/xuanwu-factory/common/bun:1.2 AS deps
WORKDIR /app

# 复制 lockfile + package.json（可选：lockfile 不存在也能 build）
COPY package.json* bun.lock* ./

# 装全量依赖（含 dev 用于 typecheck；build 阶段会用到）
# 不加 --frozen-lockfile：CI 上 build context 可能不含 bun.lock
RUN bun install

# ───── Stage 2: build ─────
# 类型检查 + 准备生产源码
FROM deps AS build
WORKDIR /app

# 复制源码 + 配置示例
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY config.example.yaml ./config.example.yaml

# 类型检查（typecheck 失败 → build 失败）
RUN bun run typecheck

# ───── Stage 3: runtime ─────
# 精简运行镜像：只装 prod 依赖 + 必要文件
FROM nexus.aimstek.cn/xuanwu-factory/common/bun:1.2-slim AS runtime
WORKDIR /app

# 系统工具（健康检查用 wget + curl）
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget tini \
    && rm -rf /var/lib/apt/lists/*

# 复制 package.json + lockfile（只装 prod 依赖，lockfile 可选）
COPY --chown=root:root package.json* bun.lock* ./

# 装 prod 依赖（用 root，bun 用户没权限 mkdir）
RUN bun install --production \
    && chown -R bun:bun /app/node_modules /app/package.json

# 复制构建产物（源码 + public + config 示例）
COPY --chown=bun:bun --from=build /app/src ./src
COPY --chown=bun:bun --from=build /app/public ./public
COPY --chown=bun:bun --from=build /app/config.example.yaml ./config.example.yaml

# 数据目录（运行时挂卷或本地持久化）
RUN mkdir -p /app/data && chown -R bun:bun /app/data

# 切回 bun 用户运行
USER bun

# 环境变量默认值（运行时可通过 -e 覆盖）
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
# 健康检查每 30s 一次，连续 3 次失败视为不健康
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${WS_PORT}/health || exit 1

# 用 ENTRYPOINT（不是 CMD）方便接收 SIGTERM（docker stop）
ENTRYPOINT ["/usr/bin/tini", "--", "bun"]
CMD ["src/server.ts"]
