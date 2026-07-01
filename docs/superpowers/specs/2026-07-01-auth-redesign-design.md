# ARM 认证架构重设计方案

> 日期：2026-07-01
> 状态：**已落地（核心模块上线）**
> 范围：backend（ARM）、workstation、cli 三端的登录与凭证体系

## 0. 实施后修订（errata）

实施过程中发生了一处关键架构 pivot：

- **原方案 §1.2 / §2.2 / §5**：以 Casdoor 作为 IdP（其内部联邦飞书 OAuth + 邮箱密码），ARM 通过 `xuanwu-sso-sdk` 调 Casdoor 的 OAuth2 endpoint。
- **实际落地**：**直接对接飞书新版 OIDC**（`open.feishu.cn/open-apis/authen/v1/index` + `/authen/v1/access_token` + `/authen/v1/user_info`），完全绕过 Casdoor 和 `xuanwu-sso-sdk`。原因：
  1. Casdoor 的 authorize URL 路径与 SDK 文档不符（前者 `/login/oauth/authorize` → 404；后者走 SDK 自己的封装），调试成本高
  2. SDK 1.0.5 的 `OAuth2Client` 接口与飞书新版 OIDC 不兼容（要求 `app_access_token` 头）
  3. 邮箱密码登录原本就没用户使用，CASDOOR 联邦邮箱密码没必要保留

邮箱密码路径**整体砍掉**（不进 user_identities 表）。其他不变：仍是一个凭证类型（PAT）、单一 `authenticate()` 路径、`user_identities(provider, providerUserId)` 多对一。

下面带"✗"标记的小节代表**已不再准确**，实施时改成了括号中说明。

## 1. 背景与触发问题

### 1.1 触发事件

最近一次用户在 Workstation 点击「沉淀 → knowledge → 发布到 ARM」时，报错：

```
沉淀失败: 未授权
```

定位过程暴露了认证体系中的一系列架构问题：

| # | 问题 | 后果 |
|---|------|------|
| 1 | Hono 4.12 中 `app.use("/runs", requireAuth)` 不匹配子路径（需 `"/runs/*"`） | requireAuth 实际从未对任何子路由生效 |
| 2 | ARM 客户端用模块级 `_currentToken` 全局变量在请求间传递 token | 并发/全局泄漏隐患，根因还是 #1 |
| 3 | `ArmClient.createKnowledge()` 失败时丢弃 `res.msg` | 真实 ARM 报错永远被吞 |
| 4 | `authenticate()` 有 4 条 fallthrough 路径（cookie + JWT + apiKey hash + SSO 联邦） | 每次出 bug 都要在 4 条里猜哪条走的 |
| 5 | 密码登录 / 自注册返回的 `token` 字段值是 apiKey | 一个长期凭证既当密码又当 Bearer 令牌，循环自洽 |

而临时打补丁（`createKnowledge` 透出 `res.msg`、全局中间件注入 token）虽然在断点上救回了知识创建，但只是把症状压住，没有消除**架构脆弱性**——下一次新增客户端或路由还会踩同样的坑。

### 1.2 现状盘点（改之前）

> ✗ 本节按"实施前状态"记录，详见 §0 errata。

ARM 当时支持 3 条登录路径（飞书 SSO via Casdoor、邮箱密码、API Key）：

1. **飞书 SSO（OAuth2 + Casdoor）**：ARM dashboard 走 `xuanwu-sso-sdk` 的 OAuth2Client，回调到 `/auth/callback`，设置 `access_token` cookie。
2. **邮箱 + 密码**：自注册或管理员创建后，`POST /api/v1/auth/password-login`，返回 `{ user, token: apiKey }`——`token` 是用户的 apiKey raw 值。
3. **API Key**：`POST /api/v1/auth/login`，body 传 `{ apiKey }`，返回同一份 `{ user, token: apiKey }`（其实啥也没干，只是确认 key 有效）。

`authenticate()` 的 fallthrough 链有 4 条：

```
authenticate(request)
├── authenticateBySSO(request)         // 从 cookie 读 access_token，调 SSO SDK
└── authenticateByApiKey(request)
    ├── token 有 "." → authenticateBySSOToken(token)   // 跨域 SSO Bearer (JWT)
    └── 否则 → apiKeyHash = sha256(token); prisma.user.findUnique({apiKeyHash})
```

四条路径之间语义重叠（SSO 和 apiKey 都能作为 Bearer 来）。workstation 不得不写 `_currentToken` 模块全局来在 middleware 和 handler 之间传递状态。

CLI 当时只能在管理员预发一个 apiKey 后用 `arm login <serverUrl> <apiKey>` 登录——这是当初设计 apiKey 的初衷（让 CLI 能在「授权后」登录）。

Workstation 提供两种登录入口（API Key 表单 / SSO 跳转），两条路径走的都是模块全局变量。

## 2. 目标与非目标

### 2.1 目标

1. **单一凭证类型**：所有客户端（CLI、Workstation、未来新增）走同一种 token。
2. **单一 `authenticate()` 路径**：Bearer 一条路走到黑。
3. **统一身份**：飞书用户和邮箱用户在 User 表里是同一类公民，登录入口尽量收敛到一处。
4. **可撤销、可审计**：每个 token 有生命周期和最后使用时间。
5. **架构合理优先于兼容**：旧 apiKey 直接废掉，不做灰度迁移。

### 2.2 非目标

- ~~不引入新的外部 IdP（继续用 Casdoor 作为联邦登录入口）。~~ **实际：完全砍掉 Casdoor，直接对接飞书。**
- 不重做 ARM dashboard 的视觉/信息架构（只改登录逻辑和 token 管理页）。
- 不实现 OAuth Device Code 或 Loopback IP Redirect（CLI 第一版用「手动 paste PAT」，后续可优化）。
- 不实现细粒度 scope/permission 系统（保留单一 `role: USER | admin`）。
- ~~不解决 CASDOOR 自身的 SSO 配置问题。~~ **已无关：CASDOOR 已废弃。**
- ~~邮箱密码自注册/登录。~~ **已砍：现代企业内部基本都用 SSO，留着只是攻击面。**

## 3. 方案对比与取舍

### 3.1 候选方案

| 方案 | 一句话 | 客户端凭证 | ARM 后端复杂度 |
|------|--------|-----------|--------------|
| A. **PAT-only（推荐）** | 所有客户端拿 PAT 用 Bearer | PAT | 一条 `authenticate()` 路径 |
| B. PAT + JWT 双轨 | CLI 用 PAT，Workstation 用 Casdoor JWT | PAT, JWT | 两条 `authenticate()` 路径 |
| C. JWT-only + Device Code | CLI 走 OAuth Device Code，Workstation 走 Authorization Code | JWT | 一条 `authenticate()` 路径（只认 JWT），但 Casdoor 必须开 Device Code endpoint |

### 3.2 取舍

**A. PAT-only（推荐）**
- ✅ `authenticate()` 一条路径；ARM 只关心 Bearer + 前缀 `arm_pat_`
- ✅ 撤销天然（`user_tokens.revoked_at`），最后使用时间天然
- ✅ CLI / Workstation / 未来客户端零差异化（都是「带 Bearer 调 API」）
- ❌ 没有自动 refresh：浏览器端 PAT 到期得重新授权
- ❌ CLI 第一版要手动从 ARM dashboard 复制 PAT 粘贴

**B. PAT + JWT 双轨**
- ❌ `authenticate()` 两条路径，正是想消解的复杂度
- ❌ 浏览器端要单独维护 refresh cookie + 跨域换 token 流程
- ❌ Workstation 必须自己注册 OAuth client，多一处运维

**C. JWT-only + Device Code**
- ✅ 浏览器端体验最好（自动 refresh）
- ❌ 飞书用户没有密码，CLI 必须走 Device Code（Casdoor 支持但需要配置）
- ❌ 撤销 JWT 需 CASDOOR 配合，本地无法立即吊销
- ❌ JWT 失窃窗口期长，除非 JWT 寿命短 + refresh 链可靠

### 3.3 结论

选 **A. PAT-only**。

理由：内部工具场景下，「没有自动 refresh」是可控代价（用户隔几十天点一次重新授权），换取的是后端极简（一条路径）、凭证可撤销（自然优势）、未来扩展零摩擦。JWT 的「自动 refresh」对面向公众的 SaaS 价值大，对内部工具是过度设计。

## 4. 统一 PAT 模型设计

### 4.1 Token 形态

```
arm_pat_<43 chars of url-safe base64>
```

前缀 `arm_pat_` 用来在 `authenticate()` 里快速识别凭证类型（避免和未来万一混入的别种 Bearer 混淆）。

### 4.2 唯一一条 `authenticate()` 路径

> **精确表述**：单条**验证**逻辑（PAT 哈希查表 + 过期/撤销检查），**两个 token 来源**（Authorization header 优先；同域 cookie 作为同域浏览器的便利回退）。

```ts
// backend/src/lib/auth.ts (重写)
import crypto from 'crypto';
import prisma from './db';

export async function authenticate(request: NextRequest): Promise<User | null> {
  // 两个来源：跨域/CLI 走 Authorization header；同域浏览器可走 httpOnly cookie
  const bearer = request.headers.get('Authorization')?.startsWith('Bearer ')
    ? request.headers.get('Authorization')!.slice(7).trim()
    : null;
  const cookie = request.cookies.get('arm_pat')?.value;
  const token = bearer || cookie;
  if (!token || !token.startsWith('arm_pat_')) return null;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = await prisma.userToken.findUnique({
    where: { token_hash: tokenHash },
    include: { user: true },
  });
  if (!row || row.revoked_at) return null;
  if (row.expires_at && row.expires_at < new Date()) return null;

  // 异步记录最后使用时间（fire-and-forget，不阻塞请求）
  prisma.userToken.update({
    where: { id: row.id },
    data: { last_used_at: new Date() },
  }).catch(() => {});

  return row.user;
}
```

**消失的东西**：
- `authenticateBySSO`（cookie 里的 CASDOOR session）：删
- `authenticateByApiKey`（apiKey hash）：删
- `authenticateBySSOToken`（JWT）：删
- `hashApiKey` / `encryptApiKey` / `decryptApiKey` / `API_KEY_MASTER_KEY`：删
- ~~`xuanwu-sso-sdk` 在 ARM 后端的 `getUserInfo` 调用：删（由 ARM 自己的「PAT 颁发」环节调一次以同步 user_identities）~~ → **实际：整个 `xuanwu-sso-sdk` 包从 `package.json` 删掉**，ARM 后端直接用 `fetch` 调飞书三个 endpoint
- `/api/auth/callback` 路由：保留路径但改成「颁发 PAT 后 302 回调」的形式

### 4.3 数据模型

#### User（精简）

```prisma
model User {
  id        String   @id @default(uuid())
  name      String?
  email     String?  @unique
  role      String   @default("USER")
  createdAt DateTime @default(now())

  identities UserIdentity[]
  tokens     UserToken[]

  @@map("users")
}
```

删掉：`ssoUserId`、`feishuUnionId`、`apiKeyHash`、`encryptedApiKey`、`passwordHash`、`avatarUrl`（avatar 移到独立的 UserProfile 表是另一回事，本次不动）。

#### UserIdentity（新表，一对多）

```prisma
model UserIdentity {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  provider        String   // ✗ 实际只有 'feishu'（邮箱/CASDOOR 已砍）
  providerUserId  String   @map("provider_user_id")  // feishu=union_id
  metadata        Json?
  linkedAt        DateTime @default(now()) @map("linked_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
  @@map("user_identities")
}
```

一个 User 可同时关联飞书 unionId + 邮箱，账号打通的关键。

#### UserToken（新表，PAT 存储）

```prisma
model UserToken {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  name        String                       // "CLI on macbook" / "Workstation @ office" / "Dashboard session"
  tokenHash   String    @unique @map("token_hash")  // sha256(arm_pat_xxx)
  scopes      Json?                         // 留口子，第一版不用
  expiresAt   DateTime?  @map("expires_at") // null = 永不过期
  lastUsedAt  DateTime?  @map("last_used_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  revokedAt   DateTime?  @map("revoked_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("user_tokens")
}
```

### 4.4 登录总流程（不区分客户端类型）

```
任何客户端获得 PAT 的步骤（直接对接飞书）：
  1. 用户在浏览器里飞书 OAuth 授权
  2. 飞书 302 到 ARM 的 `/api/auth/callback?code=...&state=...`
  3. ARM 后端直接 `fetch` 飞书的 `/authen/v1/access_token`（用 app_id/app_secret）→ 拿到 `access_token`
  4. ARM 再 `fetch` `/authen/v1/user_info`（Bearer access_token）→ 拿到 `union_id`、`name`、`email`
  5. ARM 在 User / UserIdentity 表 upsert（provider='feishu', providerUserId=union_id）
  6. ARM 生成 `arm_pat_xxx`，写入 user_tokens，返回给客户端
  7. 客户端把 PAT 带在 `Authorization: Bearer` 头里调业务 API
```

> ✗ 原方案写的是「先经过 Casdoor 联邦」—— 实际是直接对接飞书，没有中间层。

## 5. 各客户端详细流程

### 5.1 ARM Dashboard（同域）

dashboard 是 Next.js 自带的前端，跟后端同域。流程最简单：

```
[Dashboard Login 页]
   │
   │ 用户点 "登录"（dashboard 自动跳转）
   ▼
[GET /api/auth/login?next=/dashboard]
   │ 服务端：构造飞书 authorize URL，302
   ▼
[飞书登录页]  https://open.feishu.cn/open-apis/authen/v1/index
   │ 用户完成登录
   ▼
[GET /api/auth/callback?code=xxx&state=<encoded next>]
   │ 服务端：
   │   1) POST /authen/v1/access_token（JSON body + app_id/app_secret）→ access_token
   │   2) GET /authen/v1/user_info（Bearer）→ union_id/name/email
   │   3) upsert User + UserIdentity（provider='feishu', providerUserId=union_id）
   │   4) 生成 arm_pat_xxx，存 user_tokens，name="Dashboard session"
   │   5) Set-Cookie: arm_pat=arm_pat_xxx; HttpOnly; Secure; SameSite=Lax
   │   6) 302 → state 解码出的 next（默认 /dashboard）
   ▼
[Dashboard 页面]
   │ 所有 /api/* 请求浏览器自动带 cookie
   │ ARM 后端 authenticate() 优先读 Authorization，没有则回退 cookie：
   │
   │   // authenticate 的 cookie 回退（仅同域）
   │   const cookieToken = request.cookies.get('arm_pat')?.value;
   │   const bearer = request.headers.get('Authorization')?.slice(7) || cookieToken;
```

**注意**：虽然首选是「纯 Bearer」，但为了 dashboard 的体验（cookie 自动带、刷新不掉登录），保留 cookie 路径作为同域的特殊优化。后端 authenticate() 实质上仍然是「读 token → 验 PAT」一条逻辑，只是 token 的取处多了一个来源。

### 5.2 Workstation（跨域 :4000）

workstation 是独立部署的 Hono SPA，与 ARM (:3000) 跨域。Cookie 不能共享，token 必须显式传：

```
[Workstation Login 页]
   │
   │ 用户点 "用 ARM 登录"
   ▼
[GET /api/ws/auth/login-url]
   │ Workstation 后端读 ARM 配置，构造飞书 authorize URL
   │ 返回 { loginUrl: "https://open.feishu.cn/open-apis/authen/v1/index?..." }
   │
   │ 前端 window.location.href = loginUrl
   ▼
[飞书登录页] (用户完成登录)
   │
   │ 飞书 302 到 ARM 的统一回调端点，带上 state（base64url JSON { next, wsCallback }）
   ▼
[GET /api/auth/callback?code=xxx&state=<encoded>]
   │ ARM 服务端：
   │   1) POST /authen/v1/access_token → access_token
   │   2) GET /authen/v1/user_info → union_id/name/email
   │   3) upsert User + UserIdentity（provider='feishu', providerUserId=union_id）
   │   4) 生成 arm_pat_xxx，name="Workstation @ <date>"
   │   5) 渲染一个中间页：
   │      <script>
   │        const url = '<ws-callback>#token=' + encodeURIComponent(arm_pat_xxx);
   │        window.location.href = url;
   │      </script>
   ▼
[Workstation 收到 #token=...]
   │ 前端 parse hash，存 sessionStorage（不写 localStorage，避免 XSS 长期窃取）
   │ navigate('/')
   ▼
[Workstation 日常请求]
   │ Authorization: Bearer arm_pat_xxx  (前端 api() 统一加)
```

Workstation 后端不再需要 `_currentToken` 模块全局——可以用 Hono context (`c.set('token', ...)`) 替代，因为之前 #1 的根本问题（middleware 不匹配）已经解决，`requireAuth` 用正确的 `"/api/ws/*"` 通配符就能正确跑。

**关于 refresh**：第一版不做。PAT 到期（用户可设 90 天 / 1 年 / 永不过期）后，用户重新走一次上面的流程。Workstation 在 401 时跳回登录页。

### 5.3 CLI

最朴素的「paste token」模式：

```
$ arm login
ℹ 请在浏览器打开下面的 URL，创建一个 PAT，复制其值粘贴到此处：
  https://arm.example.com/settings/tokens?purpose=cli

请粘贴 PAT: arm_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxx
✓ 登录成功! 欢迎, 张三

# 写 ~/.arm/config.json (chmod 600)
{
  "serverUrl": "https://arm.example.com",
  "token": "arm_pat_xxxxxxxxxx",
  "user": { "id": "...", "name": "张三", "email": "zhangsan@example.com" }
}

$ arm whoami
当前用户: 张三 (zhangsan@example.com)
```

所有 API 调用：`Authorization: Bearer arm_pat_xxx`。

未来可优化：CLI 起本地 HTTP server（`http://127.0.0.1:9999/callback`）+ CASDOOR Loopback IP Redirect，自动从浏览器拿到 PAT，省掉手动复制。**本方案不在第一版范围**。

## 6. 组件改动清单

### 6.1 Backend (ARM)

**删 / 改：**
- ❌ `src/lib/auth.ts`：删 `hashApiKey` / `encryptApiKey` / `decryptApiKey` / `authenticateBySSO` / `authenticateByApiKey` / `authenticateBySSOToken`；保留 `authenticate` 重写为 PAT-only 单路径
- ❌ `src/lib/sso.ts`：删 `ssoClient` / `ssoConfig`（CASDOOR 客户端配置搬到 `auth/callback` 路由内联）
- ❌ `src/app/api/v1/auth/login/route.ts`：删（apiKey 登录废）
- ❌ `src/app/api/v1/auth/password-login/route.ts`：删（密码登录全部走 CASDOOR）
- ❌ `src/app/api/v1/auth/register/route.ts`：删（自注册走 CASDOOR 自助注册页）
- 🔧 `src/app/api/auth/callback/route.ts`：改写为「颁发 PAT」语义
- 🔧 `src/app/api/auth/session/route.ts`：保留，但只读 cookie 里的 PAT
- 🔧 Prisma schema：按 §4.3 改
- 🔧 迁数据：把现有 `User.apiKeyHash` 行的 hash 搬到 `user_tokens` 作为一条 `name="imported"` 的记录（标记 deprecated，过渡期用）

**新增：**
- ✅ `GET /api/auth/callback` 改写：**飞书** 回调，按 `state` 参数区分下发目标（dashboard 同域 / workstation 跨域），统一颁发 PAT
- ✅ `POST /api/v1/tokens`（创建 PAT，需登录）
- ✅ `GET /api/v1/tokens`（列自己的 PAT）
- ✅ `DELETE /api/v1/tokens/:id`（撤销 PAT）
- ✅ `PATCH /api/v1/tokens/:id`（改 name / expires_at）
- ✅ Dashboard 「设置 → Tokens」管理页（列出、新建、撤销）

### 6.2 Workstation

**删：**
- ❌ `public/main.js` 里的 API Key 表单 + "用 API Key 登录" 按钮
- ❌ `src/arm-client/client.ts` 里的 `_currentToken` 模块全局 + 单例 client 逻辑（改成 Hono context）
- ❌ `src/server.ts` 里我们之前临时加的 `/api/ws/*` 注入中间件（迁移到 `requireAuth` 正确通配符后就没必要存在）

**改：**
- 🔧 `src/server.ts`：`requireAuth` 用 `"/api/ws/*"` 通配符；新增 `GET /api/ws/auth/login-url` 返回飞书 authorize URL；新增 `GET /api/ws/auth/callback` 接收 PAT 写入 sessionStorage
- 🔧 `public/main.js` 登录页改成单一「用飞书/ARM 登录」按钮，handle `#token=` hash
- 🔧 `src/arm-client/client.ts`：token 走 Hono context，handler 内取，不污染模块全局

### 6.3 CLI

**删：**
- ❌ `arm login <serverUrl> <apiKey>` 这种需要预发 key 的形态 → 改成 `arm login` 无参数，提示用户去 ARM 自助生成 PAT

**改：**
- 🔧 `cli/src/cmd/auth.ts`：login 改成 paste-PAT 模式
- 🔧 `cli/src/lib/storage.ts`：写文件时 `chmod 600`
- 🔧 `cli/src/lib/client.ts`：Bearer header 逻辑不变，但 token 字符串约定以 `arm_pat_` 开头（可选断言）

**新增：**
- ✅ `arm token list / revoke`（CLI 也能管理自己的 PAT）

## 7. 安全考虑

- **PAT 哈希存储**：服务端只存 `sha256(token)`，泄漏 DB 也无法反向出 token。
- **PAT 显示一次**：创建时明文只返回一次，用户必须自己保存。
- **撤销立即生效**：`revoked_at` 写入后下一次 `authenticate()` 即失败。
- **过期可空**：`expires_at` 允许 null（永不过期），但 dashboard 默认建议设过期。
- **token 长度**：43 字符 base64（256 bit 熵），暴力破解不可行。
- **CLI 配置文件权限**：`chmod 600`。
- **Workstation 内存存储**：放 sessionStorage 而非 localStorage，关 tab 即丢，减小 XSS 长期泄漏窗口。
- **Dashboard cookie**：httpOnly + Secure + SameSite=Lax；`Secure` 在生产强制。
- **日志**：服务端不打印 token 原值，只打印 `token_id`（user_token.id）。
- **轮换提示**：dashboard 「设置 → Tokens」页对超过 N 个月的 PAT 给出建议轮换提示（仅 UI，不强制）。

## 8. 迁移计划

不需要兼容（用户确认），按顺序：

1. **schema 迁移**：删 User 旧字段，加 user_identities / user_tokens 表
2. **数据迁移脚本**（一次性）：
   - 把 `User.feishuUnionId` 移到 `UserIdentity{provider:'feishu', providerUserId:unionId}`
   - `User.apiKeyHash` / `User.encryptedApiKey` / `User.passwordHash`：**直接 DROP**，不迁 PAT（用户重新登录时按新流程拿 PAT）
   - 邮箱用户保留 `User.email`（用作身份去重和查找）
3. **代码切换**：PR 一次性合并（虽然 diff 大，但目标明确，没有需要灰度的兼容性边界）
4. **运维通知**：告诉所有用户「老 apiKey 已废，请去 ARM Settings → Tokens 重新生成 PAT；CLI 用 `arm login` 重登」
5. **CI 验证**：tsc + 手动 smoke（curl 走通「飞书登录 → 拿 PAT → 调 API → 撤销 → 再调 401」整条链）

## 9. 风险与未决议题

| 项 | 风险 | 缓解 |
|----|------|------|
| 飞书 OAuth client 未配置 redirect_uri | 飞书 302 回调时返回 `redirect_uri_mismatch` | 文档列清楚所需环境变量；部署前 dry-run |
| 邮箱用户的密码现在交给 CASDOOR 处理，CASDOOR ROPC 是否开启 | 部分部署可能没开 | 部署时确认 CASDOOR 配置；提供 fallback 让 ARM 直接校验邮箱密码发 PAT（但偏离统一原则） |
| PAT 一旦泄漏到第三方（如有人复制粘贴贴错地方） | 风险等同长 JWT | 用户随时可在 dashboard 撤销；CLI 配置文件权限 |
| 跨域刷新问题在 dashboard 登出场景 | 跨域 dashboard 登出需要回调通知 | 第一版不做远程登出，用户自己点 dashboard 的「登出」按钮 |
| `UserIdentity` 的 metadata 字段是否会塞进敏感信息 | 第三方数据沉淀问题 | 文档约束只存 provider 公开 user info；定期审计 |

## 10. 验收标准

改完后满足：

- [ ] 新用户走飞书登录 ARM，落地后能在 dashboard「设置 → Tokens」看到自己的 UserIdentity 行
- [ ] 新用户走邮箱注册（CASDOOR 入口）后能登录
- [ ] dashboard 创建 PAT → 复制 → 在 Workstation 登录页粘贴（或反向）→ Workstation 业务接口能调通
- [ ] CLI `arm login` 粘贴 PAT → `arm agent ls` 工作
- [ ] dashboard 撤销 PAT → Workstation / CLI 下一次调用收到 401
- [ ] PAT 过期后下一次调用 401，且错误信息明确「PAT 已过期」
- [ ] 搜索代码：`grep -r "API_KEY_MASTER_KEY\|encryptedApiKey\|hashApiKey\|authenticateByApiKey\|authenticateBySSOToken" backend/src` 结果为空
- [ ] ARM 后端 `authenticate()` 函数体不超过 25 行，单一职责
- [ ] Workstation 没有模块级全局 `_currentToken` 之类变量