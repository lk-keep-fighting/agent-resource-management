# ──────────────────────────────────────────────────────────
# Agent Workstation Dockerfile
#
# 假设 CI build context 是仓库根目录（包含 workstation/ 子目录）。
# 使用 Dockerfile.base 预装好系统工具的 base 镜像，避免重复 apt-get install。
# Base 镜像构建：见 Dockerfile.base。
# ──────────────────────────────────────────────────────────

# 允许通过 --build-arg WS_BASE_IMAGE=xxx 覆盖 base 镜像（本地开发用）
ARG WS_BASE_IMAGE=nexus.aimstek.cn/arm:ws-base-0646e10

# ───── Stage 1: prepare ─────
FROM nexus.aimstek.cn/xuanwu-factory/common/bun:1.2 AS prepare
WORKDIR /app

# 从 build context 的 workstation/ 子目录复制（CI 场景）
# 本地 build 也兼容（相对路径）
COPY workstation/package.json ./
COPY workstation/tsconfig.json ./
COPY workstation/bun.lock* ./
COPY workstation/src ./src
COPY workstation/public ./public
COPY workstation/config.example.yaml ./

# 装全量依赖（含 dev 用于 typecheck）
# 不加 --frozen-lockfile：CI build context 可能不含 bun.lock
RUN bun install

# 类型检查（CI 失败则 build 失败）
RUN bun run typecheck

# ───── Stage 2: runtime ─────
FROM ${WS_BASE_IMAGE} AS runtime
WORKDIR /app

# /app/data 已由 base 镜像预创建并 chown，无需重复

# 从 prepare 阶段显式 COPY 需要的产物
COPY --chown=bun:bun --from=prepare /app/node_modules /app/node_modules
COPY --chown=bun:bun --from=prepare /app/src /app/src
COPY --chown=bun:bun --from=prepare /app/public /app/public
COPY --chown=bun:bun --from=prepare /app/package.json /app/package.json

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${WS_PORT}/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "bun"]
CMD ["src/server.ts"]
