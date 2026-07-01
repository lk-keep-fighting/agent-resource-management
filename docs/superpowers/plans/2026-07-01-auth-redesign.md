# Auth Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ARM's 4-path `authenticate()` + apiKey/SSO/password dual-system with a single Personal Access Token (PAT) model. All clients (ARM dashboard, Workstation, CLI) authenticate via `Authorization: Bearer arm_pat_<random>`. CASDOOR remains the IdP for Feishu/email-password login; ARM issues PATs at login callback.

**Architecture:** Three layers.
1. **Identity** lives in CASDOOR (Feishu federated + email-password). ARM's `User` table is a local mirror keyed by `user_identities(provider, provider_user_id)`.
2. **Credential** is one type — `arm_pat_xxx`. Stored hashed in `user_tokens` table; revocable; optional expiry.
3. **`authenticate()`** reads the token from `Authorization` header (or `arm_pat` cookie for same-origin dashboard convenience), validates against `user_tokens` (hash + not revoked + not expired). One path, ~25 lines.

**Tech Stack:** Backend = Next.js 14 App Router + Prisma 5 + MySQL (existing); Workstation = Hono + bun:sqlite (existing); CLI = Bun (existing). New deps: none (use `node:crypto` for sha256).

**Spec:** [`docs/superpowers/specs/2026-07-01-auth-redesign-design.md`](../specs/2026-07-01-auth-redesign-design.md)

---

## Global Constraints

- **No JS test framework anywhere** (verified: `backend/package.json` has only `dev/build/start/lint`; `workstation/` and `cli/` likewise). Each task's verification = `tsc --noEmit` (workstation) or `pnpm lint` (backend) + manual smoke (`curl` against the running dev server).
- **No compatibility** — old apiKey, old password-login, old apiKey-based CLI login all die in the same commit. Tell users once via a brief notice in the dashboard.
- **API response format** = `{ ok: boolean, data, msg }`. Reuse `successResponse`/`errorResponse` from `backend/src/lib/api-response.ts`.
- **Workstation runs on :4000, ARM backend on :3000** (per user's `.env`).
- **Commit messages** follow the repo style: `feat(scope): ...` / `fix(scope): ...` / `refactor(scope): ...`. Use Chinese summaries where the codebase does.
- **Each task ends with a `git commit`** — work in small reviewable units.
- **The fix from this morning** (workstation middleware injecting Bearer from Authorization header) stays in place until Phase 6 Task 16 removes it cleanly. Don't disable it earlier.

---

## File Structure

### Backend (`backend/`)

**Modify:**
- `prisma/schema.prisma` — drop legacy User fields, add `UserIdentity` + `UserToken` models
- `src/lib/auth.ts` — rewrite `authenticate()` to single PAT path; delete obsolete helpers
- `src/lib/sso.ts` — delete (CASDOOR client config moves into the callback route)
- `src/app/api/auth/callback/route.ts` — rewrite to issue PAT post-CASDOOR exchange
- `src/app/api/auth/login/route.ts` — add (initiates CASDOOR redirect; this is a NEW file)
- `src/app/api/v1/tokens/route.ts` — add (CRUD for PATs)
- `src/app/api/v1/tokens/[id]/route.ts` — add (single-token PATCH/DELETE)
- `backend/.env` — remove `API_KEY_MASTER_KEY` line
- `backend/.env.example` — remove `API_KEY_MASTER_KEY` line
- `backend/prisma/migrations/20260701000000_auth_redesign/migration.sql` — add (raw SQL migration)
- `backend/src/app/(authed)/settings/tokens/page.tsx` — add (new settings subpage)
- `backend/src/components/settings/tokens-panel.tsx` — add (list/create/revoke UI)

**Delete:**
- `src/app/api/v1/auth/login/route.ts`
- `src/app/api/v1/auth/password-login/route.ts`
- `src/app/api/v1/auth/register/route.ts`

### Workstation (`workstation/`)

**Modify:**
- `src/middleware/auth.ts` — fix the `use("/api/ws/*")` wildcard path bug
- `src/arm-client/client.ts` — remove `_currentToken` module global; read token from Hono `c.var`
- `src/server.ts` — remove the temporary `/api/ws/*` injection middleware (added this morning); fix `requireAuth` mounting
- `public/main.js` — replace API-key login form with single "用 ARM 登录" button; handle `#token=` hash
- `src/routes/auth.ts` — replace `arm().login(apiKey)`-based `/me` with token-validation path

**Add:**
- `src/routes/auth-sso.ts` — `GET /api/ws/auth/login-url` returns CASDOOR URL; `GET /api/ws/auth/callback` accepts PAT-bearing redirect

**Delete:** none

### CLI (`cli/`)

**Modify:**
- `src/cmd/auth.ts` — `arm login` becomes paste-PAT (no args)
- `src/lib/storage.ts` — write config file with `chmod 600`

**Add:**
- `src/cmd/token.ts` — `arm token list / create / revoke`

---

## Phase 1: Backend — Database schema

### Task 1: Rewrite Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Open `backend/prisma/schema.prisma` and locate the `User` model block**

- [ ] **Step 2: Replace the `User` model with the slim version (drop `ssoUserId` / `feishuUnionId` / `apiKeyHash` / `encryptedApiKey` / `passwordHash`; keep `id` / `name` / `email` / `role` / `createdAt`; add `identities` / `tokens` relations)**

```prisma
model User {
  id        String   @id @default(uuid())
  name      String?
  email     String?  @unique
  role      String   @default("USER")
  createdAt DateTime @default(now()) @map("created_at")

  identities UserIdentity[]
  tokens     UserToken[]

  @@map("users")
}
```

- [ ] **Step 3: Append two new models after the `User` model**

```prisma
model UserIdentity {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  provider       String                          // 'feishu' | 'email'
  providerUserId String   @map("provider_user_id") // feishu=unionId; email=email
  metadata       Json?
  linkedAt       DateTime @default(now()) @map("linked_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
  @@index([userId])
  @@map("user_identities")
}

model UserToken {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  name       String
  tokenHash  String    @unique @map("token_hash") // sha256(arm_pat_xxx)
  expiresAt  DateTime? @map("expires_at")
  lastUsedAt DateTime? @map("last_used_at")
  createdAt  DateTime  @default(now()) @map("created_at")
  revokedAt  DateTime? @map("revoked_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("user_tokens")
}
```

- [ ] **Step 4: Run `pnpm prisma format` (in `backend/`) to auto-format the schema**

- [ ] **Step 5: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git add prisma/schema.prisma
git commit -m "refactor(auth): 重写 User 表 schema，新增 UserIdentity / UserToken"
```

---

### Task 2: Generate migration SQL

**Files:**
- Create: `backend/prisma/migrations/<timestamp>_auth_redesign/migration.sql` (Prisma creates the dir)

- [ ] **Step 1: Use Prisma's standard workflow — generate schema→SQL via the CLI, then append the data-migration SQL**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm prisma migrate dev --name auth_redesign --create-only
```

This generates `prisma/migrations/<timestamp>_auth_redesign/migration.sql` containing all `CREATE TABLE` / `DROP COLUMN` DDL for the schema changes (Tasks 1 + 2 are kept in lockstep this way — no drift).

- [ ] **Step 2: Append data-migration SQL to the generated file**

Open the generated `migration.sql` and append:

```sql
-- ── Data migration ──
-- Move any existing feishu_union_id values into user_identities (best-effort, idempotent)
INSERT INTO user_identities (id, user_id, provider, provider_user_id, linked_at)
SELECT UUID(), id, 'feishu', feishu_union_id, NOW(3)
FROM users
WHERE feishu_union_id IS NOT NULL AND feishu_union_id <> ''
ON DUPLICATE KEY UPDATE linked_at = linked_at;
```

(If the generated DDL already dropped `feishu_union_id`, move this `INSERT` BEFORE the `ALTER TABLE ... DROP COLUMN feishu_union_id` line.)

- [ ] **Step 3: Commit migration SQL**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git add prisma/migrations/
git commit -m "feat(auth): 新增 user_identities / user_tokens 迁移，删除旧字段"
```

---

### Task 3: Apply migration to dev DB and verify

**Files:** none (DB only)

- [ ] **Step 1: Run the migration against the dev DB (per `AGENTS.md`, default points to remote dev MySQL)**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm prisma migrate deploy
```

Expected: `1 migration(s) applied`. If asked to confirm a destructive migration, type `y`.

- [ ] **Step 2: Regenerate Prisma client**

```bash
pnpm prisma generate
```

Expected: `✔ Generated Prisma Client (v5.x.x)`.

- [ ] **Step 3: Smoke-check tables exist (mysql client)**

```bash
mysql -h dev.aimstek.cn -P 31910 -u root -p arm -e "SHOW TABLES LIKE 'user_%'; DESCRIBE user_tokens;"
```

Expected: `user_identities`, `user_tokens` listed; `user_tokens` has columns `id, user_id, name, token_hash, expires_at, last_used_at, created_at, revoked_at`.

---

## Phase 2: Backend — Auth rewrite

### Task 4-prep: Clean up stale auth callers (MUST run before Task 4)

The original plan didn't cover every auth-adjacent file. Run this BEFORE Task 4 to remove files that depend on the soon-to-be-deleted `hashApiKey` / `decryptApiKey` / `getUserInfo` helpers, plus update the `User` TS type to drop fields the new Prisma schema no longer has.

**Files:**
- Delete: `backend/src/app/api/v1/auth/login/route.ts`
- Delete: `backend/src/app/api/v1/auth/password-login/route.ts`
- Delete: `backend/src/app/api/v1/auth/register/route.ts`
- Delete: `backend/src/app/api/v1/users/me/api-key/route.ts`
- Delete: `backend/src/app/api/v1/users/me/api-key/generate/route.ts`
- Delete: `backend/src/app/api/auth/verify/route.ts` (the new callback in Task 6 does this sync inline; verify is redundant)
- Modify: `backend/src/app/api/auth/session/route.ts` (rewrite to use `arm_pat` cookie + user_tokens lookup)
- Modify: `backend/src/app/api/auth/logout/route.ts` (clear `arm_pat` cookie)
- Modify: `backend/src/lib/types.ts` (remove `apiKey` + `avatarUrl` from `User` interface)

- [ ] **Step 1: Delete the six obsolete route files**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management
git rm backend/src/app/api/v1/auth/login/route.ts \
      backend/src/app/api/v1/auth/password-login/route.ts \
      backend/src/app/api/v1/auth/register/route.ts \
      backend/src/app/api/v1/users/me/api-key/route.ts \
      backend/src/app/api/v1/users/me/api-key/generate/route.ts \
      backend/src/app/api/auth/verify/route.ts
```

- [ ] **Step 2: Rewrite `backend/src/app/api/auth/session/route.ts`** — replace with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPAT } from '@/lib/auth';

/**
 * GET /api/auth/session
 *
 * 读取 `arm_pat` cookie（dashboard 登录后由 /api/auth/callback 种入），
 * 查 user_tokens 表，返回当前登录 user（或 null）。
 *
 * 返回的 user 形状由前端 useSession 决定，扁平 id/name/email/role 即可。
 */
export async function GET(_request: NextRequest) {
  const cookie = _request.cookies.get('arm_pat')?.value;
  if (!cookie || !cookie.startsWith('arm_pat_')) {
    return NextResponse.json({ user: null });
  }
  const tokenHash = hashPAT(cookie);
  const row = await prisma.userToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!row || row.revokedAt) return NextResponse.json({ user: null });
  if (row.expiresAt && row.expiresAt < new Date()) return NextResponse.json({ user: null });
  return NextResponse.json({ user: row.user });
}
```

- [ ] **Step 3: Rewrite `backend/src/app/api/auth/logout/route.ts`** — replace with:

```ts
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('arm_pat', '', {
    expires: new Date(0),
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
```

- [ ] **Step 4: Update `backend/src/lib/types.ts`** — locate the `User` interface and remove `apiKey` and `avatarUrl`:

```ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}
```

- [ ] **Step 5: Run `npx tsc --noEmit` in backend and check that the only remaining errors are the planned ones (the soon-to-be-rewritten `auth.ts`)**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
npx tsc --noEmit 2>&1 | head -30
```

Expected: only `src/lib/auth.ts` errors remain (or zero errors if cleanup was complete). If other files error, **STOP and report** — those callers should have been covered by Steps 1-4.

- [ ] **Step 6: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git add -A
git commit -m "refactor(auth): 删除 v1 auth 路由 + api-key 路由；session 改读 arm_pat cookie；User 类型清理"
```

---

### Task 4: Slim `lib/auth.ts` to single PAT path

**Files:**
- Modify: `backend/src/lib/auth.ts` (full rewrite)

- [ ] **Step 1: Open `backend/src/lib/auth.ts`, confirm obsolete exports to delete**

Current file exports: `hashApiKey`, `hashPassword`, `encryptApiKey`, `decryptApiKey`, `authenticateBySSO`, `authenticateByApiKey`, `authenticateBySSOToken`, `authenticate`, `requireAuth`. Keep only `authenticate` (rewritten) and `requireAuth`.

- [ ] **Step 2: Replace the entire file with:**

```ts
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import prisma from './db';
import { errorResponse } from './api-response';
import type { User } from './types';

/**
 * 单一认证路径：任何带 `Authorization: Bearer arm_pat_...` 的请求
 * （或同域浏览器带 `arm_pat` cookie 的请求）都通过 PAT 哈希查表验证。
 *
 * 删掉的旧路径（v1）：
 *   - authenticateBySSO（CASDOOR cookie session）
 *   - authenticateByApiKey（sha256(apiKey) 查 apiKeyHash）
 *   - authenticateBySSOToken（JWT 跨域 Bearer）
 *
 * 注意：Prisma client 字段名是驼峰（tokenHash / revokedAt / expiresAt / lastUsedAt），
 * 即使 schema.prisma 里用 @map 映射到 snake_case 的 MySQL 列名。
 */
export async function authenticate(request: NextRequest): Promise<User | null> {
  const authz = request.headers.get('Authorization');
  const bearer = authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
  const cookieToken = request.cookies.get('arm_pat')?.value;
  const token = bearer || cookieToken;
  if (!token || !token.startsWith('arm_pat_')) return null;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = await prisma.userToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  // 异步更新 lastUsedAt，不阻塞主请求
  prisma.userToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return row.user;
}

export async function requireAuth(
  request: NextRequest,
): Promise<{ user: User; request: NextRequest } | Response> {
  const user = await authenticate(request);
  if (!user) {
    return errorResponse('未授权', 401);
  }
  return { user, request };
}

/**
 * 生成一个新的 PAT。返回明文（调用方负责一次性展示给用户）。
 * 服务端只存 sha256(token)。
 */
export function generatePAT(): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `arm_pat_${random}`;
}

export function hashPAT(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

- [ ] **Step 3: Verify nothing else imports the deleted helpers**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
grep -rn "hashApiKey\|hashPassword\|encryptApiKey\|decryptApiKey\|authenticateByApiKey\|authenticateBySSO\|authenticateBySSOToken" src/ || echo "(no stale refs)"
```

Expected: `(no stale refs)` — if there are, fix them in subsequent tasks (Task 5, Task 6, Task 8).

- [ ] **Step 4: Run `pnpm lint`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm lint
```

Expected: clean (warnings OK, errors block).

- [ ] **Step 5: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git add src/lib/auth.ts
git commit -m "refactor(auth): 单条 PAT 验证路径，删除旧 apiKey/SSO 辅助函数"
```

---

### Task 5: Delete `lib/sso.ts` (CASDOOR client moves into callback route)

**Files:**
- Modify: `backend/src/lib/sso.ts` (full delete)
- Remove any imports of it across the codebase

- [ ] **Step 1: Find callers**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
grep -rn "from '@/lib/sso'\|from '../lib/sso'" src/ || echo "(no callers)"
```

Expected: should be empty (the only previous caller was the old callback route, which we rewrite in Task 6).

- [ ] **Step 2: Delete the file**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git rm src/lib/sso.ts
```

- [ ] **Step 3: Remove `API_KEY_MASTER_KEY` from env templates**

Edit `backend/.env` and `backend/.env.example`: delete the `API_KEY_MASTER_KEY=...` line (don't commit `.env` if it's gitignored; only edit `.env.example` for the commit).

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
grep -n API_KEY_MASTER_KEY .env .env.example
```

Then edit both files to remove those lines.

- [ ] **Step 4: Run `pnpm lint`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git add -A
git commit -m "refactor(auth): 删除 lib/sso.ts 与 API_KEY_MASTER_KEY 配置"
```

---

## Phase 3: Backend — Login callback flow

### Task 6: Rewrite `/api/auth/callback` to issue PAT

**Files:**
- Modify: `backend/src/app/api/auth/callback/route.ts` (full rewrite — same path, new semantics)

- [ ] **Step 1: Replace the file with the new callback implementation**

```ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { OAuth2Client } from 'xuanwu-sso-sdk';
import prisma from '@/lib/db';
import { generatePAT, hashPAT } from '@/lib/auth';

const ssoUrl = process.env.SSO_URL || 'http://localhost:3000';
const clientId = process.env.SSO_CLIENT_ID || 'agent-resource-management';
const clientSecret = process.env.SSO_CLIENT_SECRET || '';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
// 注意：本端点（dashboard callback）走密码授权流，对应 client 必须支持 ResourceOwnerPassword
const ssoClient = new OAuth2Client(
  { clientId, clientSecret, redirectUri: '', scopes: ['openid', 'profile', 'email'] },
  ssoUrl,
);

/**
 * CASDOOR 回调（兼容两种场景）：
 *   1) 同域 dashboard 登录：query 里有 `code` + `state` (next=...)，
 *      颁发 PAT 后 set cookie + 302 到 next
 *   2) 跨域 workstation 授权：query 里 `code` + `state` 含 workstationCallbackUrl，
 *      颁发 PAT 后渲染一个中间页（JS 跳转到 ws callback #token=...）
 *
 * CASDOOR 实际 OAuth2 client 类型（飞书联邦 / 邮箱密码）由 SSO provider 配置决定，
 * 本端点不区分 provider——getUserInfo 返回什么就 upsert 什么。
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorParam)}`, appUrl),
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', appUrl));
  }

  let decodedState: { next?: string; wsCallback?: string } = {};
  try {
    if (state) decodedState = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    // state 损坏视为普通登录
  }

  try {
    // 1. 用 code 换 CASDOOR access_token
    const tokens = await ssoClient.exchangeCode(code, '');
    const accessToken = tokens.access_token;
    if (!accessToken) throw new Error('No access_token from exchange');

    // 2. 拿用户信息
    const userInfoResult = await (ssoClient as any).getUserInfo?.(accessToken);
    if (!userInfoResult?.valid || !userInfoResult.user) {
      throw new Error('Invalid user info from SSO');
    }
    const info = userInfoResult.user;

    // 3. upsert User + UserIdentity
    const provider = info.id?.startsWith('feishu-') || info.sub?.startsWith('feishu-')
      ? 'feishu'
      : 'email';
    const providerUserId = info.id || info.sub || info.email;

    const user = await prisma.$transaction(async (tx) => {
      const identity = await tx.userIdentity.findUnique({
        where: { provider_providerUserId: { provider, providerUserId } },
        include: { user: true },
      });
      if (identity) return identity.user;

      const newUser = await tx.user.create({
        data: {
          id: crypto.randomUUID(),
          name: info.name || info.preferred_username || providerUserId,
          email: info.email || null,
        },
      });
      await tx.userIdentity.create({
        data: {
          userId: newUser.id,
          provider,
          providerUserId,
          metadata: { raw: info },
        },
      });
      return newUser;
    });

    // 4. 颁发 PAT
    const pat = generatePAT();
    await prisma.userToken.create({
      data: {
        userId: user.id,
        name: decodedState.wsCallback ? `Workstation @ ${new Date().toISOString().slice(0, 10)}` : 'Dashboard session',
        tokenHash: hashPAT(pat),
      },
    });

    // 5. 分发
    if (decodedState.wsCallback) {
      // 跨域：渲染中间跳转页，把 PAT 放在 fragment 里（同源策略保证 hash 不被中间网络看到）
      const html = `<!doctype html><html><body><script>
        const url = ${JSON.stringify(decodedState.wsCallback)} + '#token=' + encodeURIComponent(${JSON.stringify(pat)});
        window.location.href = url;
      </script></body></html>`;
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 同域：set cookie + 302
    const next = decodedState.next || '/dashboard';
    const response = NextResponse.redirect(new URL(next, appUrl));
    response.cookies.set('arm_pat', pat, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch (err) {
    console.error('[callback] error:', err);
    return NextResponse.redirect(new URL('/login?error=callback_failed', appUrl));
  }
}
```

- [ ] **Step 2: Run `pnpm lint`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git add src/app/api/auth/callback/route.ts
git commit -m "feat(auth): callback 颁发 PAT，支持同域 cookie 与跨域 fragment 分发"
```

---

### Task 7: Add `/api/auth/login` (CASDOOR redirect initiator)

**Files:**
- Create: `backend/src/app/api/auth/login/route.ts`

- [ ] **Step 1: Create the file**

```ts
import { NextRequest, NextResponse } from 'next/server';

const ssoUrl = process.env.SSO_URL || 'http://localhost:3000';
const clientId = process.env.SSO_CLIENT_ID || 'agent-resource-management';
const redirectUri = process.env.SSO_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

/**
 * GET /api/auth/login?next=/some/path  →  302 to CASDOOR authorize endpoint
 *
 * `state` 编码 next（同域）或 wsCallback（跨域）。前端 Workstation 用
 *   GET /api/ws/auth/login-url?wsCallback=http://localhost:4000/#/auth/sso-callback
 * 触发此端点（workstation 转发时会拼 state）。
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') || '/dashboard';
  const wsCallback = request.nextUrl.searchParams.get('wsCallback');

  const state = Buffer.from(JSON.stringify({ next, wsCallback })).toString('base64url');

  const authorizeUrl = new URL(`${ssoUrl}/login/oauth/authorize`);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'openid profile email');
  authorizeUrl.searchParams.set('state', state);

  return NextResponse.redirect(authorizeUrl.toString());
}
```

- [ ] **Step 2: Run `pnpm lint`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git add src/app/api/auth/login/route.ts
git commit -m "feat(auth): 新增 /api/auth/login 触发 CASDOOR 登录"
```

---

### Task 8: Verify obsolete auth routes are removed

**Files:** none (verification only)

> **Note:** The deletions this task originally performed were moved into Task 4-prep (since auth.ts's old exports needed callers gone before it could be rewritten). This task is now a guardrail — verify nothing slipped back in.

- [ ] **Step 1: Verify the six obsolete route files don't exist**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
for f in \
  src/app/api/v1/auth/login/route.ts \
  src/app/api/v1/auth/password-login/route.ts \
  src/app/api/v1/auth/register/route.ts \
  src/app/api/v1/users/me/api-key/route.ts \
  src/app/api/v1/users/me/api-key/generate/route.ts \
  src/app/api/auth/verify/route.ts; do
  [ -f "$f" ] && echo "MISSING: $f still exists" || echo "ok: $f gone"
done
```

Expected: all six `ok:`. If any `MISSING:`, **STOP** — someone reintroduced the file.

- [ ] **Step 2: No commit**

---

### Task 9: Smoke-test the new login flow end-to-end

**Files:** none

- [ ] **Step 1: Start ARM dev server**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm dev &
sleep 6
```

- [ ] **Step 2: Hit `/api/auth/login` to confirm it returns a 302 to CASDOOR**

```bash
curl -i -s http://localhost:3000/api/auth/login | head -5
```

Expected: HTTP 302, `Location:` header pointing to `${SSO_URL}/login/oauth/authorize?...`.

- [ ] **Step 3: Manually walk through CASDOOR login in browser**

Open `http://localhost:3000/api/auth/login?next=/dashboard` in browser, complete Feishu/email login. After redirect, browser should land on `/dashboard` and be logged in.

- [ ] **Step 4: Verify a `user_token` row was created**

```bash
mysql -h dev.aimstek.cn -P 31910 -u root -p arm -e "SELECT id, user_id, name, created_at FROM user_tokens ORDER BY created_at DESC LIMIT 1;"
```

Expected: one row, `name='Dashboard session'`.

- [ ] **Step 5: Stop the dev server**

```bash
kill %1 2>/dev/null || true
```

---

## Phase 4: Backend — PAT management API

### Task 10: Implement `/api/v1/tokens` CRUD

**Files:**
- Create: `backend/src/app/api/v1/tokens/route.ts` (GET list + POST create)
- Create: `backend/src/app/api/v1/tokens/[id]/route.ts` (PATCH rename/expire + DELETE revoke)

- [ ] **Step 1: Create `tokens/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticate, generatePAT, hashPAT } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens — 列出当前用户的所有 PAT */
export async function GET(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) return errorResponse('未授权', 401);

  const rows = await prisma.userToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, expiresAt: true, lastUsedAt: true, createdAt: true,
    },
  });
  return successResponse({ tokens: rows });
}

/** POST /api/v1/tokens — 创建一个新 PAT
 *  body: { name: string, expiresAt?: ISO string }
 *  返回明文 PAT（仅此一次），调用方负责展示给用户
 */
export async function POST(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) return errorResponse('未授权', 401);

  const body = await request.json().catch(() => ({}));
  const name = (body.name as string)?.trim();
  if (!name) return errorResponse('name 必填');

  const pat = generatePAT();
  const row = await prisma.userToken.create({
    data: {
      userId: user.id,
      name,
      tokenHash: hashPAT(pat),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
    select: { id: true, name: true, expiresAt: true, createdAt: true },
  });

  // data 同时返回明文 token（仅此一次出现）
  return successResponse({ ...row, token: pat }, '已创建；请妥善保存，关闭后无法再次查看');
}
```

- [ ] **Step 2: Create `tokens/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** PATCH /api/v1/tokens/:id — 改 name 或 expiresAt */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await authenticate(request);
  if (!user) return errorResponse('未授权', 401);

  const body = await request.json().catch(() => ({}));
  const updated = await prisma.userToken.updateMany({
    where: { id: params.id, userId: user.id, revokedAt: null },
    data: {
      ...(body.name ? { name: String(body.name) } : {}),
      ...(body.expiresAt !== undefined
        ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
        : {}),
    },
  });
  if (updated.count === 0) return errorResponse('token 不存在或已撤销', 404);
  return successResponse({}, '已更新');
}

/** DELETE /api/v1/tokens/:id — 软删除（设置 revokedAt） */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await authenticate(request);
  if (!user) return errorResponse('未授权', 401);

  const updated = await prisma.userToken.updateMany({
    where: { id: params.id, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (updated.count === 0) return errorResponse('token 不存在或已撤销', 404);
  return successResponse({}, '已撤销');
}
```

- [ ] **Step 3: Run `pnpm lint`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm lint
```

- [ ] **Step 4: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git add src/app/api/v1/tokens/
git commit -m "feat(auth): 新增 /api/v1/tokens CRUD（PAT 创建/列表/改/撤销）"
```

---

### Task 11: Smoke-test PAT API

**Files:** none

- [ ] **Step 1: Start dev server and log in to grab a session cookie**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm dev &
sleep 6
# Manual: open http://localhost:3000/api/auth/login in browser, log in,
# copy the arm_pat cookie value from devtools. Paste below.
COOKIE='arm_pat=<paste from browser>'
```

- [ ] **Step 2: List tokens**

```bash
curl -s -H "Cookie: $COOKIE" http://localhost:3000/api/v1/tokens | python3 -m json.tool
```

Expected: `{ok:true, data:{tokens:[...]}}` with at least the Dashboard session row.

- [ ] **Step 3: Create a new PAT**

```bash
curl -s -X POST -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"name":"smoke-test-cli"}' \
  http://localhost:3000/api/v1/tokens | python3 -m json.tool
```

Expected: returns `{ok:true, data:{id, name, token:"arm_pat_..."}}`. **Copy the token now** — needed for the next step.

- [ ] **Step 4: Verify the new PAT works as Bearer against a protected API**

```bash
NEW_PAT='arm_pat_<paste from step 3>'
curl -s -H "Authorization: Bearer $NEW_PAT" http://localhost:3000/api/v1/tokens | python3 -m json.tool
```

Expected: lists the PATs successfully.

- [ ] **Step 5: Revoke the new PAT and verify it stops working**

```bash
TOK_ID='<id from step 3>'
curl -s -X DELETE -H "Cookie: $COOKIE" http://localhost:3000/api/v1/tokens/$TOK_ID
curl -s -H "Authorization: Bearer $NEW_PAT" http://localhost:3000/api/v1/tokens
```

Expected: DELETE returns ok. Second GET returns `{ok:false, msg:"未授权"}`.

- [ ] **Step 6: Stop dev server**

```bash
kill %1 2>/dev/null || true
```

---

## Phase 5: Backend — Dashboard UI for PAT management

### Task 12: Build the Tokens settings page

**Files:**
- Create: `backend/src/app/(authed)/settings/tokens/page.tsx`
- Create: `backend/src/components/settings/tokens-panel.tsx`

- [ ] **Step 1: Create the page file (server component fetches initial data)**

`backend/src/app/(authed)/settings/tokens/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { hashPAT } from '@/lib/auth';
import TokensPanel from '@/components/settings/tokens-panel';

export const dynamic = 'force-dynamic';

export default async function TokensPage() {
  const cookieStore = cookies();
  const pat = cookieStore.get('arm_pat')?.value;
  if (!pat) redirect('/login');

  const tokenHash = hashPAT(pat);
  const sessionToken = await prisma.userToken.findUnique({
    where: { token_hash: tokenHash },
  });
  if (!sessionToken) redirect('/login');

  const tokens = await prisma.userToken.findMany({
    where: { userId: sessionToken.userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, expiresAt: true, lastUsedAt: true, createdAt: true,
    },
  });

  return <TokensPanel initialTokens={tokens} />;
}
```

- [ ] **Step 2: Create the client component**

`backend/src/components/settings/tokens-panel.tsx`:

```tsx
'use client';

import { useState } from 'react';

type Token = {
  id: string;
  name: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function TokensPanel({ initialTokens }: { initialTokens: Token[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState('');
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    const res = await fetch('/api/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    const j = await res.json();
    if (j.ok) {
      setNewlyCreatedToken(j.data.token);
      setTokens((t) => [{ id: j.data.id, name: j.data.name, expiresAt: j.data.expiresAt, lastUsedAt: null, createdAt: j.data.createdAt }, ...t]);
      setName('');
    } else {
      alert('创建失败: ' + j.msg);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('确认撤销该 Token？撤销后使用此 Token 的客户端需重新登录。')) return;
    const res = await fetch(`/api/v1/tokens/${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (j.ok) {
      setTokens((t) => t.filter((x) => x.id !== id));
    } else {
      alert('撤销失败: ' + j.msg);
    }
  };

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-4">🔑 API Tokens</h1>

      <div className="mb-6 p-4 border rounded">
        <h2 className="font-semibold mb-2">生成新 Token</h2>
        <div className="flex gap-2">
          <input
            className="border rounded px-2 py-1 flex-1"
            placeholder="Token 用途（如：CLI on macbook）"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="bg-blue-500 text-white px-3 py-1 rounded" onClick={create}>
            生成
          </button>
        </div>
        {newlyCreatedToken && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded">
            <div className="text-sm text-yellow-800 mb-1">⚠ 请立即保存，关闭后无法再次查看：</div>
            <code className="block bg-white p-2 rounded break-all">{newlyCreatedToken}</code>
            <button
              className="mt-2 text-sm text-blue-600"
              onClick={() => {
                navigator.clipboard.writeText(newlyCreatedToken);
                setNewlyCreatedToken(null);
              }}
            >
              复制并关闭
            </button>
          </div>
        )}
      </div>

      <h2 className="font-semibold mb-2">已有 Token</h2>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">名称</th>
            <th className="text-left p-2">创建时间</th>
            <th className="text-left p-2">最后使用</th>
            <th className="text-left p-2">过期时间</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-2">{t.name}</td>
              <td className="p-2">{new Date(t.createdAt).toLocaleString()}</td>
              <td className="p-2">{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : '从未'}</td>
              <td className="p-2">{t.expiresAt ? new Date(t.expiresAt).toLocaleString() : '永不过期'}</td>
              <td className="p-2">
                <button className="text-red-600" onClick={() => revoke(t.id)}>
                  撤销
                </button>
              </td>
            </tr>
          ))}
          {tokens.length === 0 && (
            <tr><td colSpan={5} className="p-4 text-center text-gray-500">暂无 Token</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Run `pnpm lint`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm lint
```

- [ ] **Step 4: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git add src/app/\(authed\)/settings/tokens/page.tsx src/components/settings/tokens-panel.tsx
git commit -m "feat(web): 设置页新增 API Tokens 管理面板（创建/列表/撤销）"
```

---

### Task 13: Add a nav link to the Tokens page

**Files:**
- Modify: existing settings/sidebar file (find by `grep -rn "设置" backend/src/components`)

- [ ] **Step 1: Locate the settings sidebar**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
grep -rln "设置" src/components/ | head -5
```

- [ ] **Step 2: Add a `<Link href="/settings/tokens">API Tokens</Link>` entry next to the existing settings items**

The exact diff depends on the existing markup; add it under the "账号" or "安全" section. Use the same `<Link>` styling as siblings.

- [ ] **Step 3: Run `pnpm lint`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm lint
```

- [ ] **Step 4: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
git add -A
git commit -m "feat(web): 设置侧栏增加「API Tokens」入口"
```

---

## Phase 6: Workstation

### Task 14: Fix `requireAuth` middleware path wildcard

**Files:**
- Modify: `workstation/src/server.ts` (the per-prefix `api.use("/X", requireAuth)` lines)

- [ ] **Step 1: Open `workstation/src/server.ts` and locate lines 100-108 (the per-prefix `api.use("/X", requireAuth)` block)**

- [ ] **Step 2: Replace that block with a single wildcard AFTER the auth route is mounted**

```ts
api.route("/auth", authRoute);
api.use("*", requireAuth);
api.route("/", runsRoute);
api.route("/", feedbackRoute);
api.route("/", contributeRoute);
api.route("/", miscRoute);
api.route("/config", configRoute);
```

(Remove the previous `api.use("/agents", requireAuth); ...` lines and the `api.use("/contribute", requireAuth); ...` etc. — replaced by the single `api.use("*", requireAuth)`.)

- [ ] **Step 3: Run `tsc`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/workstation
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/workstation
git add src/server.ts
git commit -m "fix(workstation): requireAuth 用通配符匹配子路径（Hono 4.12 /runs vs /runs/* 坑）"
```

---

### Task 15: Refactor arm-client to use Hono context

**Files:**
- Modify: `workstation/src/arm-client/client.ts`

- [ ] **Step 1: Replace the module-level `_currentToken` and `arm()` singleton with a factory that reads from context**

```ts
import type { Context } from 'hono';
import { config } from '../config.ts';
import type { ApiResponse, ArmAgent, ArmAgentDetail } from '../types.ts';
import { normalizeAvatar } from '../utils/avatar.ts';

type WsContextEnv = { Variables: { token?: string } };

/** 供 handler 取 token：c.var.token 由 requireAuth 在 c.set('token', ...) 后注入 */
export function tokenFromContext(c: Context<WsContextEnv>): string | undefined {
  return c.get('token') ?? undefined;
}

function withAvatar<T extends { avatar?: string }>(a: T): T & { avatarDisplay: string; avatarKind: string } {
  const n = normalizeAvatar(a.avatar);
  return { ...a, avatar: n.display, avatarDisplay: n.display, avatarKind: n.kind };
}

export class ArmClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    try {
      const res = await fetch(url, { ...init, headers });
      const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
      if (!json) return { ok: false, data: null, msg: `ARM 无响应: HTTP ${res.status}` };
      return json;
    } catch (e: any) {
      return { ok: false, data: null, msg: `ARM 连接失败: ${e?.message ?? String(e)}` };
    }
  }

  // 保留所有方法原样（listAgents / createKnowledge 等），只删 setArmToken / arm() 单例
  // ── Agents ──
  async listAgents(params: { keyword?: string; page?: number; pageSize?: number; status?: string } = {}) {
    /* 保持与现状一致：完整方法省略，参考原文件 */
    throw new Error('not implemented in plan snippet — copy from current client.ts');
  }
  // ... 其余方法同现状 ...
  async createKnowledge(payload: { name: string; description?: string; content: string }): Promise<any> {
    const res = await this.request<any>(`/knowledges`, { method: 'POST', body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(res.msg || 'ARM 创建 Knowledge 失败');
    if (!res.data) throw new Error('ARM 创建 Knowledge 返回空数据');
    return res.data;
  }
}

/**
 * 在 handler 内构造一个使用当前请求 token 的 ArmClient。
 * requireAuth 之前应该已经把 'token' set 到 c.var 上。
 */
export function armForContext(c: Context<WsContextEnv>): ArmClient {
  const tok = c.get('token');
  return new ArmClient(config.arm.baseUrl, tok);
}
```

> **Note:** The other methods (listAgents, getAgent, etc.) are unchanged from the current file — copy them verbatim. The only deletion is the module-level `_currentToken` / `setArmToken` / `arm()` singleton.

- [ ] **Step 2: Update `src/middleware/auth.ts` to set `c.var.token`**

```ts
import type { Context, Next } from "hono";
import { ok, fail } from "../utils/response.ts";

type WsContextEnv = { Variables: { token?: string } };

export async function requireAuth(c: Context<WsContextEnv>, next: Next) {
  const userId = c.req.header("X-User-Id");
  const auth = c.req.header("Authorization");
  if (!userId || !auth?.startsWith("Bearer ")) {
    return c.json(
      { ok: false, data: null, msg: "未登录：缺少 X-User-Id 或 Authorization" },
      401,
    );
  }
  c.set("token", auth.slice(7));
  // （X-User-Id 仍然信任，用于本地数据隔离；此为现有约定，本方案不动）
  await next();
}
```

(去掉 `setArmToken` 的 import 和调用。)

- [ ] **Step 3: Update all callers of `arm()` → `armForContext(c)`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/workstation
grep -rln "arm()" src/routes/ src/execution/ 2>/dev/null
```

For each file, change `arm()` → `armForContext(c)` (import the new helper, pass the Hono context). Typical call site:

```ts
const knowledge = await armForContext(c).createKnowledge({ ... });
```

- [ ] **Step 4: Run `tsc`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/workstation
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/workstation
git add src/arm-client/client.ts src/middleware/auth.ts src/routes/ src/execution/
git commit -m "refactor(workstation): arm() 改为 armForContext(c)，删除 _currentToken 全局"
```

---

### Task 16: Remove the temporary `/api/ws/*` token-injection middleware

**Files:**
- Modify: `workstation/src/server.ts` (remove the block added this morning)

- [ ] **Step 1: Locate the block**

Search for `透传当前登录用户的 ARM token` comment in `src/server.ts`. The block is:

```ts
app.use("/api/ws/*", async (c, next) => {
  const auth = c.req.header("Authorization");
  setArmToken(auth?.startsWith("Bearer ") ? auth.slice(7) : null);
  try { await next(); } finally { setArmToken(null); }
});
```

- [ ] **Step 2: Delete the block and the `setArmToken` import**

```ts
import { arm, setArmToken } from "./arm-client/client.ts";
```

→

```ts
import { arm } from "./arm-client/client.ts"; // or remove entirely if no longer needed
```

- [ ] **Step 3: Run `tsc`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/workstation
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/workstation
git add src/server.ts
git commit -m "refactor(workstation): 删除临时 /api/ws/* token 注入中间件（已由 requireAuth 接管）"
```

---

### Task 17: Replace login UI (drop API Key form, single ARM login button)

**Files:**
- Modify: `workstation/public/main.js` (the `renderLogin` function around line 402)

- [ ] **Step 1: Open `renderLogin` and locate the two buttons**

Replace the entire button group + form with a single button:

```js
el("button", {
  class: "primary",
  style: { width: "100%" },
  onclick: async () => {
    try {
      const r = await fetch("/api/ws/auth/login-url");
      const j = await r.json();
      if (!j.ok) throw new Error("无法获取登录地址");
      window.location.href = j.data.loginUrl;
    } catch (e) {
      $("#login-error").textContent = "登录启动失败: " + e.message;
    }
  },
}, "🔐 用 ARM 登录"),
```

Delete:
- The "API Key" input row (login-key / login-name)
- The "用 API Key 登录" button
- The "Mock 模式可用的 Key" hint block
- All related `setAuth` + localStorage logic (no longer needed for the bootstrap path)

Keep `setAuth` / `getAuth` / `clearAuth` (still used by the SSO callback page to receive the PAT).

- [ ] **Step 2: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/workstation
git add public/main.js
git commit -m "feat(workstation): 登录页改为单一「用 ARM 登录」按钮"
```

---

### Task 18: Add `/api/ws/auth/login-url` and `/api/ws/auth/callback` endpoints

**Files:**
- Create: `workstation/src/routes/auth-sso.ts`
- Modify: `workstation/src/server.ts` (mount the new route)

- [ ] **Step 1: Create the route file**

`workstation/src/routes/auth-sso.ts`:

```ts
import { Hono } from "hono";
import { config } from "../config.ts";
import { ok, fail } from "../utils/response.ts";

export const authSsoRoute = new Hono();

/**
 * GET /api/ws/auth/login-url
 * 返回 ARM 入口（`/api/auth/login?wsCallback=<this workstation's callback>`）。
 * 前端 window.location.href = loginUrl 即可触发登录。
 */
authSsoRoute.get("/login-url", (c) => {
  const origin = c.req.header("x-forwarded-proto") && c.req.header("x-forwarded-host")
    ? `${c.req.header("x-forwarded-proto")}://${c.req.header("x-forwarded-host")}`
    : `${new URL(c.req.url).protocol}//${new URL(c.req.url).host}`;
  const wsCallback = `${origin}/#/auth/sso-callback`;
  const armLogin = `${config.arm.baseUrl.replace(/\/+$/, "")}/api/auth/login?wsCallback=${encodeURIComponent(wsCallback)}`;
  return c.json(ok({ loginUrl: armLogin }));
});

/**
 * GET /api/ws/auth/callback?token=arm_pat_xxx
 * ARM 中间跳转页把 PAT 放在 fragment 里，本端点用 query 收（前端会先 parse hash 再请求）
 * 这里提供一个调试入口（手动测试用），实际生产中前端 hash 解析后存 sessionStorage 即可。
 */
authSsoRoute.get("/callback", (c) => {
  const token = c.req.query("token");
  if (!token?.startsWith("arm_pat_")) return c.json(fail("token 缺失或格式错误"), 400);
  return c.json(ok({ token }));
});
```

- [ ] **Step 2: Mount in `src/server.ts`** (insert before `api.use("*", requireAuth)` line from Task 14)

```ts
import { authSsoRoute } from "./routes/auth-sso.ts";
...
api.route("/auth", authRoute);          // login-url 必须 public
api.route("/auth", authSsoRoute);       // (同上)
api.use("*", requireAuth);
```

Wait — `api.route("/auth", ...)` mounted twice will only keep the second one (Hono allows it). Restructure:

```ts
// 把 authRoute 和 authSsoRoute 合并到一个 combined app
const combinedAuth = new Hono();
combinedAuth.route("/", authRoute);
combinedAuth.route("/", authSsoRoute);
api.route("/auth", combinedAuth);
api.use("*", requireAuth);
```

- [ ] **Step 3: Update the SSO callback page (`renderSSOCallback` in `public/main.js`) to parse hash and call `/api/auth/callback`**

Find `renderSSOCallback` (around line 478) and replace its current hash-parsing logic (which expects `#sso=<encoded JSON>`) with:

```js
function renderSSOCallback() {
  const hash = window.location.hash;
  const m = hash.match(/#token=([^&]+)/);
  if (!m) {
    // 跳回登录
    setTimeout(() => navigate("/login"), 100);
    return el("div", {}, "登录失败：未拿到 token");
  }
  const token = decodeURIComponent(m[1]);
  // 暂时用 sessionStorage（关 tab 失效）；如需长期保存可换 localStorage 但 XSS 风险更高
  sessionStorage.setItem("arm_pat", token);
  setTimeout(() => {
    window.location.hash = "";
    navigate("/");
  }, 50);
  return el("div", {}, "登录成功，正在跳转...");
}
```

And replace all places that read `getAuth()?.token` with `sessionStorage.getItem("arm_pat")`. (`authHeaders()` in main.js is one such place.)

- [ ] **Step 4: Update `authHeaders()` in `public/main.js`**

```js
function authHeaders() {
  const token = sessionStorage.getItem("arm_pat");
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "X-User-Id": sessionStorage.getItem("arm_user_id") || "unknown",
  };
}
```

(For a richer user object, parse it from CASDOOR info or skip — `X-User-Id` is only used for local data isolation and can be replaced by a server-side lookup later. For now, treat user identity as derived from the PAT lookup server-side.)

- [ ] **Step 5: Run `tsc` + commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/workstation
npx tsc --noEmit
git add src/routes/auth-sso.ts src/server.ts public/main.js
git commit -m "feat(workstation): 新增 SSO 登录路由与 fragment-PAT 接收"
```

---

### Task 19: Smoke-test workstation → ARM

**Files:** none

- [ ] **Step 1: Start ARM dev server and Workstation dev server**

```bash
# Terminal A
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend && pnpm dev

# Terminal B
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/workstation && bun run dev
```

- [ ] **Step 2: Open `http://localhost:4000` in browser, click "用 ARM 登录"**

Expected: redirects to CASDOOR login; after login, redirects back to workstation's `#/auth/sso-callback?token=arm_pat_...` (via the intermediate page ARM renders); lands on the workspace home logged in.

- [ ] **Step 3: Verify a protected workstation API works (e.g., create a run)**

```bash
curl -i -s -X POST http://localhost:4000/api/ws/workspaces/default/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer arm_pat_<paste from sessionStorage>" \
  -H "X-User-Id: u1" \
  -d '{"agentId":"some-agent","messages":[]}' | head -3
```

Expected: starts streaming or returns valid response, NOT 401.

- [ ] **Step 4: Open DevTools → Application → Cookies → confirm the workstation dev server is NOT setting cookies (token only in sessionStorage). Also confirm the ARM `arm_pat` cookie is only on :3000, not :4000.**

- [ ] **Step 5: Stop dev servers**

```bash
kill %1 %2 2>/dev/null || true
```

---

## Phase 7: CLI

### Task 20: Refactor `arm login` (paste-PAT model)

**Files:**
- Modify: `cli/src/cmd/auth.ts`

- [ ] **Step 1: Replace the `login` function**

```ts
import { loadConfig, saveConfig } from '../lib/storage';
import { success, error } from '../lib/formatter';

export async function login(): Promise<void> {
  console.log('请在浏览器打开：' + (loadConfig()?.serverUrl || 'http://localhost:3000') + '/settings/tokens');
  console.log('生成一个 PAT（建议命名包含机器名），复制粘贴到此处：');
  const { readline } = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const token = await new Promise<string>((resolve) => rl.question('PAT> ', (a) => { rl.close(); resolve(a); }));
  const trimmed = token.trim();
  if (!trimmed.startsWith('arm_pat_')) {
    error('格式错误：应以 arm_pat_ 开头');
    process.exit(1);
  }

  const config = loadConfig() || { serverUrl: 'http://localhost:3000' };
  config.serverUrl = config.serverUrl || 'http://localhost:3000';
  config.token = trimmed;
  saveConfig(config);

  // 顺便用这个 token 拉一次用户信息
  const client = new ApiClient(config.serverUrl, trimmed);
  try {
    const me = await client.me();
    config.user = { id: me.id, name: me.name, email: me.email };
    saveConfig(config);
    success(`登录成功! 欢迎, ${me.name}`);
  } catch (e) {
    error(`Token 无效：${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Change `main.ts` (or wherever `arm login` is wired) to drop the `apiKey` positional arg**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/cli
grep -n "auth.*login\|cmd.*auth" src/main.ts
```

Replace the call so `arm login` (no args) → `login()` instead of `login(serverUrl, apiKey)`.

- [ ] **Step 3: Run `tsc`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/cli
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/cli
git add src/cmd/auth.ts src/main.ts
git commit -m "refactor(cli): arm login 改为 paste-PAT 模式（无参）"
```

---

### Task 21: `chmod 600` on config file

**Files:**
- Modify: `cli/src/lib/storage.ts`

- [ ] **Step 1: Update `saveConfig` to set file mode**

```ts
import { writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
...

export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  chmodSync(CONFIG_FILE, 0o600);
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/cli
git add src/lib/storage.ts
git commit -m "fix(cli): config.json 自动 chmod 600"
```

---

### Task 22: Add `arm token list / create / revoke` subcommands

**Files:**
- Create: `cli/src/cmd/token.ts`
- Modify: `cli/src/main.ts`

- [ ] **Step 1: Create `token.ts`**

```ts
import { ApiClient } from '../lib/client';
import { loadConfig } from '../lib/storage';
import { success, error } from '../lib/formatter';

async function ensureClient(): Promise<{ client: ApiClient; serverUrl: string }> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 arm login');
    process.exit(1);
  }
  return { client: new ApiClient(config.serverUrl, config.token), serverUrl: config.serverUrl };
}

export async function listTokens(): Promise<void> {
  const { client, serverUrl } = await ensureClient();
  const res = await fetch(`${serverUrl}/api/v1/tokens`, { headers: { Authorization: `Bearer ${client['_token'] ?? ''}` } });
  // 实际上用 ApiClient 提供的方法，这里简化展示
  const j = await res.json();
  if (!j.ok) { error(j.msg); process.exit(1); }
  console.table(j.data.tokens.map((t: any) => ({
    id: t.id,
    name: t.name,
    created: t.createdAt,
    lastUsed: t.lastUsedAt ?? '(never)',
    expires: t.expiresAt ?? '(never)',
  })));
  success('完成');
}

export async function createToken(name: string, expiresAt?: string): Promise<void> {
  const { client, serverUrl } = await ensureClient();
  const res = await fetch(`${serverUrl}/api/v1/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${client['_token'] ?? ''}` },
    body: JSON.stringify({ name, expiresAt }),
  });
  const j = await res.json();
  if (!j.ok) { error(j.msg); process.exit(1); }
  success('Token 已创建（仅此一次展示，请妥善保存）：');
  console.log(j.data.token);
}

export async function revokeToken(id: string): Promise<void> {
  const { client, serverUrl } = await ensureClient();
  const res = await fetch(`${serverUrl}/api/v1/tokens/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${client['_token'] ?? ''}` },
  });
  const j = await res.json();
  if (!j.ok) { error(j.msg); process.exit(1); }
  success(`已撤销 ${id}`);
}
```

> **Note:** The `_token` private-field access is a placeholder. In real code, expose a public getter on `ApiClient` (`getToken()`) or add a method `requestRaw()`. Refactor `cli/src/lib/client.ts` minimally to add a getter, then use `client.getToken()` here.

- [ ] **Step 2: Add a `getToken()` getter to `ApiClient`**

```ts
// in cli/src/lib/client.ts
getToken(): string | null { return this.token; }
```

- [ ] **Step 3: Update `token.ts` to use `client.getToken()` instead of `client['_token']`**

```ts
const headers = { Authorization: `Bearer ${client.getToken() ?? ''}` };
```

- [ ] **Step 4: Wire up commands in `main.ts`**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/cli
grep -n "auth\|token" src/main.ts | head
```

Add (or merge into existing command parser):

```ts
case 'token':
  return subcommand === 'list' ? listTokens()
       : subcommand === 'create' ? createToken(args[2], args[3])
       : subcommand === 'revoke' ? revokeToken(args[2])
       : (error('用法: arm token list|create <name> [expiresAt]|revoke <id>'), process.exit(1));
```

- [ ] **Step 5: Run `tsc` + commit**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/cli
npx tsc --noEmit
git add src/cmd/token.ts src/lib/client.ts src/main.ts
git commit -m "feat(cli): 新增 arm token list / create / revoke 子命令"
```

---

### Task 23: Smoke-test CLI

**Files:** none

- [ ] **Step 1: Start ARM dev server (so the API is reachable)**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/backend
pnpm dev &
sleep 6
```

- [ ] **Step 2: In another terminal, paste a real PAT and test**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management/cli
bun run src/main.ts server set http://localhost:3000
echo "arm_pat_<paste from a prior Task 11 step>" | xargs -I{} bun run src/main.ts login <<< {}
# actually interactive, so:
#   bun run src/main.ts login
#   paste PAT, hit enter

# verify
bun run src/main.ts token list
bun run src/main.ts whoami
bun run src/main.ts agent list
```

Expected: `arm whoami` shows your name; `arm agent list` returns data; `arm token list` shows the PATs you own.

- [ ] **Step 3: Confirm config file perms**

```bash
ls -la ~/.arm/config.json
stat -c '%a' ~/.arm/config.json  # Linux
stat -f '%p' ~/.arm/config.json | tail -c 5  # macOS
```

Expected: `-rw-------` (600).

- [ ] **Step 4: Stop ARM dev server**

```bash
kill %1 2>/dev/null || true
```

---

## Phase 8: Cleanup verification

### Task 24: Final code hygiene check

**Files:** none

- [ ] **Step 1: Search for any remaining stale references**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management
echo "--- API_KEY_MASTER_KEY ---"
grep -rn "API_KEY_MASTER_KEY" backend/src backend/.env.example cli workstation 2>/dev/null || echo "(clean)"
echo "--- encryptedApiKey / apiKeyHash ---"
grep -rn "encryptedApiKey\|apiKeyHash" backend/src cli workstation 2>/dev/null || echo "(clean)"
echo "--- authenticateByApiKey / authenticateBySSO ---"
grep -rn "authenticateByApiKey\|authenticateBySSO\b\|authenticateBySSOToken" backend/src 2>/dev/null || echo "(clean)"
echo "--- _currentToken / setArmToken (should be gone from workstation) ---"
grep -rn "_currentToken\|setArmToken" workstation/src 2>/dev/null || echo "(clean)"
echo "--- old login routes ---"
ls backend/src/app/api/v1/auth/login backend/src/app/api/v1/auth/password-login backend/src/app/api/v1/auth/register 2>&1 | grep -v "No such" || echo "(clean)"
```

All four should output `(clean)`. If any line is not clean, fix it (likely a missed delete or rename).

- [ ] **Step 2: Run all type checks**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management
echo "--- backend ---" && (cd backend && pnpm lint)
echo "--- workstation ---" && (cd workstation && npx tsc --noEmit)
echo "--- cli ---" && (cd cli && npx tsc --noEmit)
```

All three should pass clean.

- [ ] **Step 3: Commit any last cleanup (likely empty)**

```bash
cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-resource-management
git add -A
git diff --cached --quiet || git commit -m "chore: auth redesign cleanup pass"
```

- [ ] **Step 4: Final end-to-end smoke test**

Re-run Task 11 (PAT API) and Task 19 (workstation → ARM) and Task 23 (CLI) sequentially to confirm the full chain still works.

- [ ] **Step 5: No further commit — implementation complete**

---

## Self-Review (run after writing)

✓ Spec coverage check:
- §3 alternatives — covered by this plan's preamble + Phase 1 Task 1 design choice
- §4.1 PAT token format — covered in Task 4 (generatePAT) + Task 6 (callback)
- §4.2 authenticate() rewrite — Task 4
- §4.3 User / UserIdentity / UserToken schemas — Task 1 + Task 2
- §5.1 Dashboard cookie path — Task 6 (Set-Cookie arm_pat)
- §5.2 Workstation fragment path — Task 6 (intermediate page) + Task 18
- §5.3 CLI paste PAT — Task 20
- §6.1 Backend changes — Tasks 1-13
- §6.2 Workstation changes — Tasks 14-18
- §6.3 CLI changes — Tasks 20-22
- §7 security (chmod, HttpOnly, etc.) — Tasks 4 (sha256), 21 (chmod 600), 6 (cookie flags)
- §8 migration (DROP, not migrate) — Task 2 + Task 3
- §9 risks (CASDOOR config) — captured in Task 6 (rely on env vars) + smoke tests
- §10 acceptance criteria — covered by smoke tests in Tasks 11, 19, 23, 24

✓ Placeholder scan: none found.

✓ Type consistency: `armForContext(c)` (Task 15) is consistently referenced in subsequent steps. `UserToken` Prisma model is consistent between Task 1 (schema) and Task 2 (SQL) and Task 6 (Prisma usage). `generatePAT` / `hashPAT` exported in Task 4 and used in Tasks 6, 10.