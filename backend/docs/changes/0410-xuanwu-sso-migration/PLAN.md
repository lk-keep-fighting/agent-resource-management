# SSO集成到xuanwu-sso (OAuth2 PKCE)

## 概述

使用 xuanwu-sso-sdk@1.0.2 的 OAuth2Client 实现 OAuth2 PKCE 流程的SSO集成。

## 环境变量

```bash
# SSO 服务器
SSO_URL=http://localhost:3000
SSO_JWT_SECRET=xuanwu-sso-super-secret-jwt-key-2024
NEXT_PUBLIC_SSO_URL=http://localhost:3000

# OAuth2 客户端配置
SSO_CLIENT_ID=agent-resource-management
SSO_CLIENT_SECRET=your-client-secret
SSO_REDIRECT_URI=http://localhost:3001/api/auth/callback
```

## 变更文件

### 新增
- `src/lib/sso.ts` - OAuth2Client 配置和导出
- `src/app/api/auth/callback/route.ts` - OAuth2 回调处理

### 修改
- `src/app/(auth)/login/login-form.tsx` - 使用 OAuth2Client 登录
- `src/app/(dashboard)/layout.tsx` - 使用 OAuth2Client 获取用户信息
- `src/app/page.tsx` - 移除旧的 sso_token 处理

## OAuth2 流程

1. 用户点击登录 → `ssoClient.getAuthorizationUrl()` 获取授权 URL
2. 跳转 SSO 授权页面
3. 用户授权后回调 `/api/auth/callback?code=xxx`
4. 用 code + codeVerifier 调用 `ssoClient.exchangeCode()` 换取 token
5. 保存 access_token 到 httpOnly cookie
6. 用 token 调用 `ssoClient.getUserInfo()` 获取用户信息

## SDK API

```typescript
// OAuth2Client
ssoClient.getAuthorizationUrl(): Promise<{ url: string; codeVerifier: string }>
ssoClient.exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse>
ssoClient.getUserInfo(accessToken: string): Promise<UserInfo>
ssoClient.getLogoutUrl(postLogoutRedirectUri?: string): string

// Server-side
verifyToken(token: string): TokenPayload | null
getUserInfo(token: string): Promise<{ valid: boolean; user: SSOUser | null }>
```

## 完成状态
- [x] 实现步骤全部完成
- [x] TypeScript 编译通过
- [ ] 功能测试通过