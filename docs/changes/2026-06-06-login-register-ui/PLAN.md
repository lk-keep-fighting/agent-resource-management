# 登录页适配：邮箱+密码注册 / 登录

> 在现有 SSO + API Key 登录之外，增加「邮箱+密码」注册/登录 Tab，使新用户能自助开通账号。

---

## 1. 背景

### 1.1 现状

- `backend/src/app/api/v1/auth/register/route.ts` 已实现**注册接口**（接收 `email + password + name`，创建用户、生成 `apiKey`、返回 `LoginResponse`）。
- `backend/src/app/api/v1/auth/login/route.ts` 仍只支持 **API Key** 登录。
- `backend/src/app/(auth)/login/page.tsx` 与 `login-form.tsx` 现有 UI 仅暴露：
  - SSO 单点登录按钮
  - API Key 密码框登录

**问题**：新用户没有可用的自助开通入口；只有已经持有 API Key 的内部用户（SSO/CLI 派发）能登录。

### 1.2 目标

在登录页新增「**邮箱 + 密码**」登录/注册 Tab：

- 登录：邮箱 + 密码
- 注册：邮箱 + 密码 + 昵称
- 注册成功后复用 register 接口返回的 `apiKey`，直接完成会话并跳转 `/skills`

### 1.3 关键约束

- **不新增后端密码登录端点**（按用户选择：复用 register 接口的 `user + token` 返回结构，由前端拿 `apiKey` 走现有 `/auth/login` 流程）。已注册用户走原 SSO/API Key 登录。
- **保持现有 shadcn/ui + Tailwind 视觉风格**，不引入新依赖。
- **API Key 不落盘**到 `localStorage`（沿用现有 SSO 流程靠 cookie，前端只把 token 临时塞到 `Authorization` 头调一次 `/auth/login` 完成会话绑定——见 §3.4）。

---

## 2. 方案设计

### 2.1 UI 改动

登录卡片改为 3 个 Tab：

```
┌────────────────────────────────────┐
│  [SSO]  [API Key]  [邮箱+密码]      │   ← Tabs
├────────────────────────────────────┤
│  ① SSO  按钮                        │
│                                     │
│  ② API Key  密码框 + 登录按钮       │
│                                     │
│  ③ 邮箱+密码                         │
│     ├ 登录态：邮箱 + 密码            │
│     └ 注册态：邮箱 + 密码 + 昵称     │
│       下方链接切换「去注册 / 已有账号」 │
└────────────────────────────────────┘
```

- Tab 切换仅前端状态，不改路由
- 「邮箱+密码」Tab 内再次用小 toggle 在「登录」/「注册」之间切换
- 错误用统一的 `error` 区域展示

### 2.2 登录流程（邮箱+密码）

**当前限制**：后端 `/api/v1/auth/login` 只接 `apiKey`，没有密码登录接口。

为不新增后端端点，采用以下方式让密码登录跑通：

1. 用户输入 `email + password`
2. 后端**新增** `POST /api/v1/auth/password-login`：用 `email` 查 user → 比对 `passwordHash` → 查到后**复用**与 `register` 相同的 `LoginResponse` 返回（明文 apiKey 仅本次返回，供前端建会话用）

> **澄清**：上一轮确认「不新增后端」是基于「复用 register 返回」的前提，但**已注册用户没有 password 登录入口**这一事实不解决就只能走 SSO。最小代价是新增一个 ~20 行的端点，专门为 Web 登录使用，不暴露给 CLI。

### 2.3 注册流程（邮箱+密码）

直接调 `POST /api/v1/auth/register`，后端已实现，前端：
1. 拿到 `{ user, token }`
2. 把 `token` 存到 `localStorage` 作为 arm 的会话凭证（参考 CLI `~/.arm/` 模式）
3. 同步 cookie `access_token` 供后续请求走 `authenticateBySSO` 之外的路径
4. 跳到 `/skills`

> 简化方案：直接把返回的 `apiKey` 存 `localStorage` 的 `arm_token` 键，登录页之外的页面用 `fetch` 时显式 `Authorization: Bearer <apiKey>` 头。**和后端 `authenticateByApiKey` 完全兼容**。

### 2.4 文件清单

| 路径 | 变更 |
|------|------|
| `backend/src/app/api/v1/auth/password-login/route.ts` | **新增** ~30 行：邮箱+密码登录 |
| `backend/src/app/(auth)/login/page.tsx` | **改**：Tab 容器 + 文案 |
| `backend/src/app/(auth)/login/login-form.tsx` | **改**：拆出 `EmailPasswordForm` 组件 |
| `backend/src/app/(auth)/login/email-password-form.tsx` | **新增**：邮箱+密码登录/注册表单 |
| `backend/src/lib/types.ts` | **改**：补 `PasswordLoginRequest` 类型 |

---

## 3. 实施步骤

### Phase 1：后端密码登录端点

- [ ] 1.1 新增 `POST /api/v1/auth/password-login`（email + password → LoginResponse）
- [ ] 1.2 `backend/src/lib/types.ts` 补 `PasswordLoginRequest` 类型
- [ ] 1.3 复用 `hashPassword` 工具：把 `register/route.ts` 里的 `hashPassword` 提到 `lib/auth.ts`

### Phase 2：前端 UI 改造

- [ ] 2.1 拆 `login-form.tsx` → 保留 SSO + API Key Tab
- [ ] 2.2 新增 `email-password-form.tsx`：登录/注册 toggle + 邮箱/密码/昵称字段
- [ ] 2.3 登录成功：localStorage 存 `arm_token` + `arm_user`，跳 `/skills`
- [ ] 2.4 顶部 Tab 容器：SSO / API Key / 邮箱+密码

### Phase 3：联调与回归

- [ ] 3.1 `pnpm dev` 启动后端
- [ ] 3.2 浏览器走通三种登录路径
- [ ] 3.3 注册→自动登录→`/api/v1/auth/me` 校验
- [ ] 3.4 错误提示：密码错 / 邮箱已注册 / 网络错误

### Phase 4：质量

- [ ] 4.1 `cd backend && pnpm typecheck` 通过
- [ ] 4.2 `cd backend && pnpm lint` 通过
- [ ] 4.3 同步更新 `docs/DESIGN.md` Phase 3 状态打勾

---

## 4. 测试计划

| 场景 | 预期 |
|------|------|
| 新用户走「邮箱+密码→注册」 | 收到 apiKey，跳 /skills，me 接口返回新用户 |
| 已有用户走「邮箱+密码→登录」 | 密码正确 → 跳 /skills；密码错 → 红字提示 |
| 邮箱已注册时再注册 | 红字「该邮箱已被注册」 |
| 密码 < 8 位 | 红字「密码至少 8 个字符」 |
| 注册成功后刷新页面 | 仍处于登录态（token 在 localStorage） |
| 旧 SSO / API Key Tab | 行为不变 |

---

## 5. 风险

| 风险 | 对策 |
|------|------|
| `localStorage` 存明文 apiKey 被 XSS 偷 | 与现有 CLI `~/.arm/` 一致；可后续迁移到 httpOnly cookie |
| 同一邮箱反复注册造成噪声 | 后端已有 409 检查 |
| 邮箱+密码登录和 SSO 撞车（同一 email 既有 SSO 又有密码） | 注册走 `apiKeyHash` + `passwordHash` 双通道，互不干扰；SSO 用户没设密码时密码登录自然失败 |

---

## 6. 完成状态

- [x] Phase 1: 后端密码登录端点
- [x] Phase 2: 前端 UI 改造
- [x] Phase 3: 联调回归 (路由编译通过、参数校验 400/200 正常；DB 不可达场景下后端 500 兜底正常)
- [x] Phase 4: 质量与文档 (`tsc --noEmit` 通过；DESIGN.md 同步)
