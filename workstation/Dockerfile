# ──────────────────────────────────────────────────────────
# Agent Workstation Dockerfile
#
# 假设 CI build context 是仓库根目录（包含 workstation/ 子目录）。
# 所有 workstation 文件都从 ./workstation/ 显式复制到 /app/。
# ──────────────────────────────────────────────────────────

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
FROM nexus.aimstek.cn/xuanwu-factory/common/bun:1.2-slim AS runtime
WORKDIR /app

# 系统工具
#   - 基础：ca-certificates curl wget tini
#   - 网络诊断：ping traceroute dig mtr nmap nc tcpdump
#   - 数据库：mariadb-client (mysql 兼容)
#   - SSH/远程：openssh-client sshpass
#   - 开发必备：jq unzip vim less tree git
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget tini \
    iputils-ping traceroute dnsutils mtr-tiny nmap netcat-openbsd tcpdump \
    default-mysql-client \
    openssh-client sshpass \
    jq unzip vim-tiny less tree git \
    && rm -rf /var/lib/apt/lists/*

# 从 prepare 阶段显式 COPY 需要的产物
COPY --chown=bun:bun --from=prepare /app/node_modules /app/node_modules
COPY --chown=bun:bun --from=prepare /app/src /app/src
COPY --chown=bun:bun --from=prepare /app/public /app/public
COPY --chown=bun:bun --from=prepare /app/package.json /app/package.json

# 数据目录
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

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${WS_PORT}/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "bun"]
CMD ["src/server.ts"]
