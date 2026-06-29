# Agent Resource Management (ARM)

企业级 Agent 资源管理系统：管理 Agent、Skill、Knowledge 的全生命周期，含 CLI、Web 和一个独立的 Agent Workstation 实验项目。

## 代码结构

| 目录 | 说明 | 包管理 | 入口 |
|------|------|--------|------|
| `backend/` | Next.js 14 (App Router) + Prisma 5 + MySQL，REST API + Web 管理后台 | **pnpm** | `pnpm dev` |
| `cli/` | Bun CLI，bin 名 `arm` | bun | `bun run src/main.ts` |
| `pkg/` | 共享 TypeScript 类型 | bun workspace | — |
| `workstation/` | 独立 Agent 工作站：Hono + `bun:sqlite` + pi-agent-core | bun | `bun run dev`（端口 4000） |
| `docs/` | 设计文档与历史测试脚本 | — | — |

`bunfig.toml` 中的 bun workspace 仅包含 `cli / backend / pkg/*`；**`workstation/` 不在 workspace 内**，需独立 `cd` 安装。

各子包开发规范见 `backend/AGENTS.md` 与 `cli/AGENTS.md`，本文不重复。

## 快速开始

### backend

```bash
cd backend
pnpm install
pnpm prisma generate     # 改 schema 后必须
pnpm prisma db push      # 同步到数据库
pnpm dev
```

`backend/.env` **不入库**（在 `backend/.gitignore` 里），模板见 README §"配置环境变量"。本机 on-disk 的 `.env` 默认指向远端开发库 `dev.aimstek.cn:31910`，本地无需启 MySQL。

> **端口坑**：本地 backend 默认需运行在 **3001**（`backend/src/lib/sso.ts` 默认 `SSO_REDIRECT_URI=http://localhost:3001/api/auth/callback`），但 README 写的是 3000，CLI 默认也是 `http://localhost:3000`。启动后必须 `arm server set http://localhost:3001`，否则 SSO 回调和 CLI 联调会失败。

可用脚本（仅 `package.json` 中真实定义的）：
```bash
pnpm dev / build / start / lint   # lint = next lint
# pnpm prisma generate / db push / studio
```

### cli

```bash
cd cli
bun install
bun run src/main.ts skill ls          # 直接跑源码
bun run build                          # 产物 dist/main.js
```

无 `lint` / `typecheck` 脚本；后端子包规范里的 `pnpm typecheck`、`bun run typecheck` 是**过时**描述，**别跑**。

配置存 `~/.arm/config.json`（`serverUrl / token / user / outputMode`）；输出模式 `arm output json|text` 切换后用 `--json` 单次生效。命令清单见 `cli/AGENTS.md` §6。

### workstation

```bash
cd workstation
bun install
bun pm trust --all        # 必需：native binding postinstall
cp .env.example .env      # 填 WS_LLM_API_KEY、WS_ARM_BASE_URL
bun run dev               # http://localhost:4000
```

要求 **Bun 1.3+**（用了 `bun:sqlite`）。E2E 脚本在 `workstation/scripts/e2e-*.ts`，mock ARM 启动：`bun run mock-arm`。详见 `workstation/README.md` 与 `docs/AGENT-WORKSTATION-DESIGN.md`。

## 测试

无 CI workflow（`.github/` 不存在）。仓库内的测试脚本都是个人脚本，**路径写死在原作者机器**：

- `cli/test-regression.sh` — 跑前必须改顶部 `CLI_DIR` 路径
- `docs/tests/run-tests.sh` — 同上，并且默认 BASE_URL 是 3000（与 backend 的 3001 不一致）

修改时改成相对路径或参数化后再用。

## Git & 推送

- 默认分支：`master`
- 推送到 **两个 remote**：`./push.sh [branch]`（默认 `master`）
  - `origin` → `gitlab.aimstek.cn/xuanwu-factory/ai-tools/agent-resource-management.git`
  - `github` → `github.com/lk-keep-fighting/agent-resource-management.git`
- `backend/.env`、`data/`、`node_modules/`、`.next/`、`*.tsbuildinfo` 已在 `.gitignore` / `backend/.gitignore`，**不要** `git add -f`

## 与默认不同的约定

- **绑定是 append-only**：Agent↔Skill/Knowledge 绑定只能新增版本（version 自增）；修改用「再绑一个新版本」，删除用 `deletedAt` 软删。**绝不** update / 硬删已有 binding 行。详见 `backend/AGENTS.md` §6.3。
- **API 响应格式固定**：
  - HTTP：`{ ok: boolean, data, msg }`（`successResponse` / `errorResponse` 封装）
  - CLI JSON 模式：`{ success, data }` 或 `{ success: false, error: { code, message } }`
- **CLI JSON 模式**：`shouldOutputJson()` 分支后所有命令必须走 JSON 输出；不分支会出现解析错误。
- **Skill 上传用 multipart**（不是 JSON），存到 `backend/data/skills/<name>.zip`；Knowledge 存 `backend/data/knowledges/<id>.md`。
- **Agent 文件夹**（`arm agent create --from=<folder>`）：
  ```
  AGENT.md               # YAML frontmatter: name/description/prompt
  skills/<n>/SKILL.md
  knowledges/<n>.md
  ```
- **认证**：`Authorization: Bearer <api-key>`（Header）或 SSO Cookie；API Key 通过 `API_KEY_MASTER_KEY` 环境变量派生（`backend/src/lib/auth.ts`）。

## 验证顺序

改完代码后的标准自检：

1. **backend schema 改动**：`pnpm prisma generate` → `pnpm prisma db push` → `pnpm dev` 冒烟 → `pnpm lint`
2. **backend 业务代码**：`pnpm dev` + curl `/api/v1/health` → `pnpm lint`
3. **cli 改动**：`bun run src/main.ts <cmd>` 对着运行中的 backend 跑一遍；JSON 输出加 `--json` 检查结构
4. **workstation 改动**：`bun run dev` → 必要时跑 `bun run mock-arm` + 对应 `scripts/e2e-*.ts`
