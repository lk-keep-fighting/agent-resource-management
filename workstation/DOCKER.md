# Agent Workstation - Docker 部署指南

## 快速启动

```bash
# 1. 构建镜像
docker build -t agent-workstation:0.1.0 .

# 2. 准备 .env（注意：WS_LLM_API_KEY 必填）
cp .env.example .env
# 编辑 .env 填入真实 LLM API key
$EDITOR .env

# 3. 启动
docker run -d \
  --name agent-workstation \
  --restart unless-stopped \
  -p 4000:4000 \
  -v ws-data:/app/data \
  --env-file .env \
  agent-workstation:0.1.0

# 4. 查看日志
docker logs -f agent-workstation
```

## docker-compose 部署

```bash
docker compose up -d
```

## 必填环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `WS_LLM_API_KEY` | 智谱 GLM API key | `xxx.rcfsBugMSmP68Lrf` |
| `WS_ARM_BASE_URL` | ARM Backend 地址 | `http://arm:3000`（同网络）或 `https://arm.example.com` |

## 可选环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WS_PUBLIC_ORIGIN` | 自动检测 | Workstation 公网 URL（用于 SSO 回调地址拼接）。**生产环境必须设**：`https://ws.example.com`。不设时从请求头 `X-Forwarded-Proto` + `Host` 自动检测（反代场景可用），否则 fallback `http://localhost:4000` |
| `WS_PORT` | `4000` | HTTP 端口 |
| `WS_HOST` | `0.0.0.0` | 监听地址 |
| `WS_DB_PATH` | `/app/data/workstation.db` | SQLite 文件路径 |
| `WS_LLM_BASE_URL` | `https://open.bigmodel.cn/api/coding/paas/v4` | LLM base URL |
| `WS_LLM_MODEL` | `glm-4.5` | LLM 模型名 |
| `WS_ARM_CLI_ENABLED` | `true` | 是否启用 arm_cli tool |
| `WS_ARM_CLI_PATH` | `arm` | ARM CLI 路径（需挂载或安装） |
| `NEXT_PUBLIC_SSO_URL` | `http://sso.agent-platform.dev.aimstek.cn` | SSO 服务地址 |

## 持久化

容器 `/app/data` 目录需要持久化（用 named volume 或 bind mount）：

- `workstation.db` — SQLite 主库（ws_workspace、ws_message、ws_run 等）
- `workspaces/<id>/` — 各 Agent Workspace 文件

**重要**：删容器前先备份 volume！

## 镜像信息

| 项 | 值 |
|---|---|
| 基础镜像 | `oven/bun:1.1-slim` |
| 入口 | `bun src/server.ts` |
| 端口 | 4000 |
| 健康检查 | `GET /health` (30s 间隔) |
| 多阶段构建 | 3 阶段：deps → build (typecheck) → runtime |

## 反向代理（Nginx 示例）

```nginx
server {
  listen 80;
  server_name ws.example.com;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # SSE 流式响应需要禁用缓冲
    proxy_buffering off;
    proxy_cache off;
  }
}
```

## 故障排查

```bash
# 查看容器日志
docker logs -f agent-workstation

# 进容器调试
docker exec -it agent-workstation sh

# 手动跑迁移
docker exec -it agent-workstation bun src/db/migrate.ts

# 检查 ARM 后端连通
docker exec -it agent-workstation curl -s http://arm:3000/api/v1/health
```

## ARM CLI 集成（可选）

`arm_cli` Tool 允许 Agent 在 Workspace 里执行 ARM CLI 命令。如果启用，需要在镜像中安装 ARM CLI 或挂载二进制：

```dockerfile
# 在 runtime 阶段加（如果 arm CLI 在 host 上）：
COPY --from=ghcr.io/anomalyco/arm-cli:latest /usr/local/bin/arm /usr/local/bin/arm
```

或运行时挂载：
```bash
docker run -v /usr/local/bin/arm:/usr/local/bin/arm:ro ...
```
