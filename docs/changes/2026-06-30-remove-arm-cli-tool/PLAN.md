# 移除 arm_cli 工具及相关配置

## 背景
`workstation/` 里的 Agent 工具链里有一项 `arm_cli` —— 让 LLM 在 workspace 里调用 `arm` CLI 子进程
（`arm skill info log-parser` 这类）来查询 ARM 资源。这条路存在两个问题：

1. **依赖外部二进制**：需要镜像里安装 `arm` CLI 或挂载宿主机的 `/usr/local/bin/arm`，
   部署环境如果没装，工具直接失败。
2. **已经名存实亡**：实际场景里几乎没有"Agent 自动调 arm skill info"的需求，
   ARM 资源（Skill / Knowledge）已经在 system prompt Layer 3 注入到上下文里，
   `arm_cli` 只是"锦上添花"。

## 需求
1. 删掉 `arm_cli` tool 本身（`src/execution/tools/arm-cli.ts`）。
2. 删掉所有"启用 arm_cli"的配置项：`armCliTool` / `WS_ARM_CLI_*` / `arm_cli_enabled`。
3. 删掉所有 prompt 注入里提到 `arm_cli` 的地方（让 LLM 别再尝试调用）。
4. 删掉前端 UI 上所有 `arm_cli` 字样（启用工具勾选框的 label、config 面板的 Tool 状态行）。
5. 删掉"沉淀为 Skill"功能（之前依赖 `arm skill upload` CLI，现在没有 CLI 能力）。
   - 后端：`contribute.ts` 对 `assetType="skill"` 直接 400。
   - 前端：去掉沉淀向导里的 Skill 单选 + "查看 CLI 命令"按钮。
   - 类型：`WsAssetShare.assetType` 从 `"skill" | "knowledge" | "agent"` 缩为 `"knowledge" | "agent"`。
6. 文档同步更新。

**不动**（避免越界）：
- `arm-client/` —— ARM REST API 客户端，auth / agents / knowledge / skills / feedback 都要用。
- `ws_asset_share` 表里的 `arm_asset_id` / `arm_asset_name` 字段 —— 是 ARM REST API 沉淀用的，跟 CLI 工具无关。
- `ws_asset_share` 表的 `asset_type` 列 —— TEXT 列不动，存量历史数据保留兼容。

## 设计
纯删减，不引入新逻辑：
- `agent-runner.ts` 的 `tools` 数组里去掉 `armCliTool` 那一项；
- `runs.ts` 创建 run 时的 `toolsSnapshot` 去掉 `arm_cli` 项；
- `config.ts` / `routes/config.ts` 去掉 `armCliTool` 整个 section；
- `context-builder.ts` / `skill-tools.ts` 描述里把 `arm_cli` 提到的地方都拿掉。

## 实现步骤

### 步骤 1: 删 tool 实现文件
- [ ] 删除 `src/execution/tools/arm-cli.ts`

### 步骤 2: 去掉 tool 注册
- [ ] `src/execution/agent-runner.ts:50` 删 `import { armCliTool }`
- [ ] `src/execution/agent-runner.ts:341-342` 删 `tools.push(armCliTool as any)` 和注释

### 步骤 3: 去掉 run 创建时的 tool 快照
- [ ] `src/routes/runs.ts:48-54` 的 `toolsSnapshot` 里删 `{ name: "arm_cli", ... }` 这一项

### 步骤 4: 去掉配置项
- [ ] `src/config.ts:27-31` 删 `AppConfig.armCliTool` 字段
- [ ] `src/config.ts:88-92` 删 `armCliTool` 装载块
- [ ] `src/routes/config.ts:8` 删 `arm_cli_enabled`
- [ ] `src/routes/config.ts:23-27` 删响应里的 `armCliTool` 块

### 步骤 5: 清理 prompt 注入
- [ ] `src/execution/context-builder.ts:45-47` 删"请用 arm_cli 工具执行对应命令"那句
- [ ] `src/execution/context-builder.ts:59` 工具列表里删 `arm_cli（执行 ARM CLI 查询资源）`
- [ ] `src/execution/skill-tools.ts:6, 18, 28` 把 `arm_cli` 引用换成中性描述（保留 `available_skills` 这个 hint tool）

### 步骤 6: 清理环境变量 / yaml / compose / docker
- [ ] `.env.example:31-34` 删 `WS_ARM_CLI_*` 块
- [ ] `config.example.yaml:22-25` 删 `armCliTool` 块
- [ ] `docker-compose.yml:39-42` 删 `WS_ARM_CLI_*` env
- [ ] `Dockerfile:55-57` 删 `WS_ARM_CLI_*` ENV 默认值

### 步骤 7: 清理文档
- [ ] `DOCKER.md:92-93` 删 `WS_ARM_CLI_*` 两行
- [ ] `DOCKER.md:152-164` 删"## ARM CLI 集成（可选）"整节
- [ ] `README.md:15` 删 `- ✅ **arm_cli Tool**` 特性行
- [ ] `README.md:17` 改 `- ✅ **资产沉淀** —— ... → 调用 ARM API 创建 Knowledge / Agent`（原本就是 Knowledge/Agent，不动）
- [ ] `README.md:130-135` 删使用示例里的 arm_cli 调用步骤
- [ ] `README.md:200-203` 目录树里删 `arm-cli.ts` 那一行
- [ ] `README.md:255-258` SSE 示例里把 `toolName:"arm_cli"` 改成 `bash` 或通用占位
- [ ] `README.md:283-301` 删"## 10. arm_cli Tool 设计"整节

### 步骤 8: 清理前端 UI
- [ ] `public/main.js:955, 961` —— workspace 创建表单 "启用工具" label 去掉 `arm_cli`
- [ ] `public/main.js:1229, 1235` —— 同样位置在编辑表单里
- [ ] `public/main.js:1963, 1966` —— 第三个表单
- [ ] `public/main.js:2145-2146` —— config 面板删 `arm_cli Tool` 状态行
- [ ] `public/main.js:2053, 2061, 2069, 2076, 2081-2085, 2095-2096` —— `renderContribute` 去掉 Skill 单选项 + "查看 CLI 命令" 按钮

## 测试计划
1. `cd workstation && bun run typecheck` 全绿
2. `bun run dev` 起来后：
   - `curl http://localhost:4000/api/ws/config` —— 响应里没有 `armCliTool` 字段
   - `curl http://localhost:4000/api/ws/health` —— ARM 连通性检查还在（用的是 arm-client，不是 arm_cli tool）
3. 前端打开 workspace → 创建 → 启用工具 → 看 UI 不再出现 `arm_cli` 字样
4. 发起一个 run，看 system prompt 里不再包含 arm_cli 引导语
5. `bun run mock-arm` + `scripts/e2e-*.ts` 走一遍（如果存在 e2e）

### 步骤 9: 删"沉淀为 Skill"功能
- [ ] `src/routes/contribute.ts:67-78` 删 skill 分支，对 `assetType="skill"` 返回 400
- [ ] `src/types.ts:142` `assetType` 缩为 `"knowledge" | "agent"`
- [ ] `src/db/repos/asset-share.repo.ts:44` 同上
- [ ] `public/main.js:2053` `renderContribute` 里 `let assetType = "knowledge"` 默认值，**保留**
- [ ] `public/main.js` 沉淀向导去掉 Skill 单选项

## 待确认
- ~~`routes/contribute.ts:69-75` 的"使用 ARM CLI 上传 ZIP"提示文案~~ —— 已确认：随整个 skill 沉淀功能一起删。

## 完成状态
- [ ] 实现步骤全部完成
- [ ] typecheck 通过
- [ ] 手动验证 config / UI / prompt
