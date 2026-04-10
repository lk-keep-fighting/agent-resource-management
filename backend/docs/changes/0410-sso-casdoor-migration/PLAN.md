# SSO迁移到Casdoor

## 背景

当前使用自定义JWT-based SSO解决方案，需要迁移到casdoor-react-sdk实现。

## 需求

1. 安装casdoor-react-sdk和casdoor-js-sdk依赖
2. 创建Casdoor SDK配置模块
3. 创建AuthCallback组件处理登录回调
4. 创建SilentSignin组件处理静默登录
5. 迁移登录页面使用新的Casdoor组件
6. 迁移API路由使用Casdoor token验证
7. 添加Casdoor相关环境变量
8. 移除旧的SSO相关代码

## 环境变量

```
CASDOOR_SERVER_URL=http://sso.infra.dev.aimstek.cn/
CASDOOR_CLIENT_ID=6b62d31c4b0475ccba42
CASDOOR_APP_NAME=agent-skill-system
CASDOOR_ORGANIZATION_NAME=built-in
CASDOOR_REDIRECT_PATH=/api/auth/casdoor-callback
CASDOOR_SIGNIN_PATH=/api/auth/signin
NEXT_PUBLIC_CASDOOR_SERVER_URL=http://sso.infra.dev.aimstek.cn/
NEXT_PUBLIC_CASDOOR_CLIENT_ID=6b62d31c4b0475ccba42
NEXT_PUBLIC_CASDOOR_APP_NAME=agent-skill-system
NEXT_PUBLIC_CASDOOR_ORGANIZATION_NAME=built-in
NEXT_PUBLIC_CASDOOR_REDIRECT_PATH=/api/auth/casdoor-callback
```

## 实现步骤

### 步骤 1: 安装依赖
- [x] 安装casdoor-react-sdk和casdoor-js-sdk

### 步骤 2: 创建Casdoor SDK配置
- [x] 创建src/lib/casdoor.ts配置模块

### 步骤 3: 创建AuthCallback组件
- [x] 创建src/app/api/auth/casdoor-callback/route.ts处理回调

### 步骤 4: 创建Signin API路由
- [x] 创建src/app/api/auth/signin/route.ts处理token交换

### 步骤 5: 迁移登录页面
- [x] 更新src/app/(auth)/login/login-form.tsx使用Casdoor SDK

### 步骤 6: 迁移首页sso_token处理
- [x] 更新src/app/page.tsx移除旧的sso_token处理

### 步骤 7: 更新API路由
- [x] 更新src/app/api/auth/session/route.ts支持Casdoor token
- [x] 更新src/lib/auth.ts支持Casdoor认证
- [x] 更新src/app/api/auth/logout/route.ts清除casdoor_token

### 步骤 8: 更新环境变量
- [x] 更新.env添加Casdoor环境变量

### 步骤 9: 清理旧代码
- [ ] 暂保留旧的SSO代码（sso-client.ts被v1路由使用）

## 新增/修改的文件

- `src/lib/casdoor.ts` - 新增，Casdoor SDK配置
- `src/app/api/auth/casdoor-callback/route.ts` - 新增，处理Casdoor回调
- `src/app/api/auth/signin/route.ts` - 新增，token交换API
- `src/app/api/auth/session/route.ts` - 修改，支持Casdoor认证
- `src/app/api/auth/logout/route.ts` - 修改，清除casdoor_token
- `src/app/(auth)/login/login-form.tsx` - 修改，使用Casdoor SDK
- `src/app/page.tsx` - 修改，移除sso_token处理
- `src/app/(dashboard)/layout.tsx` - 修改，简化登录检查
- `src/lib/auth.ts` - 修改，支持Casdoor认证
- `.env` - 修改，添加Casdoor环境变量

## 测试计划

1. 访问首页，未登录状态跳转登录页
2. 点击SSO登录，跳转到Casdoor登录页
3. 使用Casdoor账号登录成功，自动跳转回首页
4. 登录状态下访问受保护的路由正常工作
5. 登出功能正常工作
6. API认证正常工作

## 完成状态
- [x] 实现步骤全部完成
- [x] TypeScript 编译通过
- [ ] 功能测试通过