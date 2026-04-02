# Agent Skill 管理系统 - 测试用例

## 目录

- [CLI 测试用例](#cli-测试用例)
- [Backend API 测试用例](#backend-api-测试用例)
- [Web UI 测试用例](#web-ui-测试用例)
- [Skill 格式验证测试](#skill-格式验证测试)

---

## CLI 测试用例

### 认证模块

#### TC-CLI-001: adk login 成功登录
```
前置条件: 服务端正常运行，用户已注册
步骤:
  1. 执行 adk login http://localhost:3000 <valid-api-key>
预期结果:
  - 输出 "Login successful"
  - API Key 存储到本地配置
```

#### TC-CLI-002: adk login 失败 (无效 API Key)
```
前置条件: 服务端正常运行
步骤:
  1. 执行 adk login http://localhost:3000 <invalid-api-key>
预期结果:
  - 输出 "Login failed: Invalid API key"
  - 不存储配置
```

#### TC-CLI-003: adk login 失败 (无效 Server URL)
```
前置条件: 无
步骤:
  1. 执行 adk login http://invalid:9999 <api-key>
预期结果:
  - 输出 "Login failed: Connection refused"
```

#### TC-CLI-004: adk logout 登出
```
前置条件: 已登录
步骤:
  1. 执行 adk logout
预期结果:
  - 输出 "Logged out"
  - 清除本地配置的 API Key
```

#### TC-CLI-005: adk logout 未登录时
```
前置条件: 未登录
步骤:
  1. 执行 adk logout
预期结果:
  - 输出 "Not logged in"
```

---

### Skill 浏览模块

#### TC-CLI-006: adk skill ls 列出所有 Skills
```
前置条件: 已登录，服务端有 Skills
步骤:
  1. 执行 adk skill ls
预期结果:
  - 输出 Skill 列表 (表格格式)
  - 每行: NAME | DESCRIPTION | DOWNLOADS | UPDATED_AT
```

#### TC-CLI-007: adk skill ls 未登录时
```
前置条件: 未登录
步骤:
  1. 执行 adk skill ls
预期结果:
  - 输出 "Please login first"
```

#### TC-CLI-008: adk skill search 搜索 Skills
```
前置条件: 已登录，服务端有匹配 Skills
步骤:
  1. 执行 adk skill search pdf
预期结果:
  - 输出名称/描述中包含 "pdf" 的 Skills
```

#### TC-CLI-009: adk skill info 查看 Skill 详情
```
前置条件: 已登录，Skill "pdf-tool" 存在
步骤:
  1. 执行 adk skill info pdf-tool
预期结果:
  - 输出完整 Skill 信息:
    - Name: pdf-tool
    - Description: ...
    - License: ...
    - File Size: ...
    - Download Count: ...
    - Published At: ...
    - Published By: ...
```

#### TC-CLI-010: adk skill info Skill 不存在
```
前置条件: 已登录
步骤:
  1. 执行 adk skill info non-existent
预期结果:
  - 输出 "Skill not found"
```

---

### Skill 下载/上传模块

#### TC-CLI-011: adk skill download 下载 Skill
```
前置条件: 已登录，Skill "pdf-tool" 存在
步骤:
  1. 执行 adk skill download pdf-tool
  2. 检查 data/skills/pdf-tool/ 目录
预期结果:
  - 下载 ZIP 包
  - 解压到 data/skills/pdf-tool/
  - 包含 SKILL.md 等文件
  - 输出 "Downloaded pdf-tool to data/skills/pdf-tool"
```

#### TC-CLI-012: adk skill download 重复下载 (覆盖)
```
前置条件: 已登录，Skill "pdf-tool" 已下载
步骤:
  1. 执行 adk skill download pdf-tool
预期结果:
  - 覆盖现有文件
  - 输出 "Updated pdf-tool"
```

#### TC-CLI-013: adk skill download Skill 不存在
```
前置条件: 已登录
步骤:
  1. 执行 adk skill download non-existent
预期结果:
  - 输出 "Skill not found"
```

#### TC-CLI-014: adk skill upload 上传 Skill
```
前置条件: 已登录，本地 data/skills/pdf-tool/ 存在
步骤:
  1. 执行 adk skill upload data/skills/pdf-tool
预期结果:
  - 压缩为 ZIP
  - 上传到服务端
  - 输出 "Uploaded pdf-tool"
```

#### TC-CLI-015: adk skill upload 目录不存在
```
前置条件: 已登录
步骤:
  1. 执行 adk skill upload data/skills/non-existent
预期结果:
  - 输出 "Directory not found"
```

#### TC-CLI-016: adk skill upload SKILL.md 缺失
```
前置条件: 已登录，本地目录无 SKILL.md
步骤:
  1. 执行 adk skill upload data/skills/invalid-skill
预期结果:
  - 输出 "Invalid skill: SKILL.md is required"
```

---

### Skill 管理模块

#### TC-CLI-017: adk skill my 查看我的发布
```
前置条件: 已登录
步骤:
  1. 执行 adk skill my
预期结果:
  - 输出当前用户发布的 Skills 列表
```

#### TC-CLI-018: adk skill delete 删除 Skill
```
前置条件: 已登录，当前用户拥有 "pdf-tool"
步骤:
  1. 执行 adk skill delete pdf-tool
预期结果:
  - 从服务端删除
  - 输出 "Deleted pdf-tool"
```

#### TC-CLI-019: adk skill delete 无权限
```
前置条件: 已登录，当前用户不拥有 "pdf-tool"
步骤:
  1. 执行 adk skill delete other-user-skill
预期结果:
  - 输出 "Permission denied"
```

#### TC-CLI-020: adk skill validate 验证有效 Skill
```
前置条件: data/skills/pdf-tool/ 存在且格式正确
步骤:
  1. 执行 adk skill validate data/skills/pdf-tool
预期结果:
  - 输出 "Valid skill: pdf-tool"
  - 列出验证项 (SKILL.md ✓, name ✓, description ✓, ...)
```

#### TC-CLI-021: adk skill validate 验证无效 Skill
```
前置条件: data/skills/invalid/ 存在但格式错误
步骤:
  1. 执行 adk skill validate data/skills/invalid
预期结果:
  - 输出 "Invalid skill:"
  - 列出所有错误:
    - SKILL.md is required
    - name must be lowercase with hyphens only
    - description is required
```

---

## Backend API 测试用例

### 认证接口

#### TC-API-001: POST /api/v1/auth/login 成功
```
请求:
  POST /api/v1/auth/login
  Body: { "apiKey": "<valid-api-key>" }

预期响应 (200):
  {
    "ok": true,
    "data": {
      "user": { "id": "...", "name": "...", "email": "..." },
      "token": "<jwt-token>"
    },
    "msg": "Login successful"
  }
```

#### TC-API-002: POST /api/v1/auth/login 无效 API Key
```
请求:
  POST /api/v1/auth/login
  Body: { "apiKey": "<invalid>" }

预期响应 (401):
  {
    "ok": false,
    "data": null,
    "msg": "Invalid API key"
  }
```

#### TC-API-003: GET /api/v1/auth/me 获取当前用户
```
请求:
  GET /api/v1/auth/me
  Header: Authorization: Bearer <token>

预期响应 (200):
  {
    "ok": true,
    "data": { "id": "...", "name": "...", "email": "..." },
    "msg": ""
  }
```

#### TC-API-004: GET /api/v1/auth/me 无 Token
```
请求:
  GET /api/v1/auth/me

预期响应 (401):
  {
    "ok": false,
    "data": null,
    "msg": "Unauthorized"
  }
```

---

### Skills 接口

#### TC-API-005: GET /api/v1/skills 列表
```
请求:
  GET /api/v1/skills

预期响应 (200):
  {
    "ok": true,
    "data": {
      "skills": [
        { "name": "pdf-tool", "description": "...", "downloadCount": 10, ... },
        ...
      ],
      "total": 100,
      "page": 1,
      "pageSize": 20
    },
    "msg": ""
  }
```

#### TC-API-006: GET /api/v1/skills 分页
```
请求:
  GET /api/v1/skills?page=2&pageSize=10

预期响应 (200):
  - 返回第 2 页，每页 10 条
```

#### TC-API-007: GET /api/v1/skills 搜索
```
请求:
  GET /api/v1/skills?q=pdf

预期响应 (200):
  - 只返回名称/描述中包含 "pdf" 的 Skills
```

#### TC-API-008: GET /api/v1/skills/:name 详情
```
请求:
  GET /api/v1/skills/pdf-tool

预期响应 (200):
  {
    "ok": true,
    "data": {
      "name": "pdf-tool",
      "description": "...",
      "license": "MIT",
      "fileSize": 12345,
      "fileHash": "sha256:...",
      "downloadCount": 10,
      "publishedAt": "2026-04-02T...",
      "publishedBy": { "id": "...", "name": "..." }
    },
    "msg": ""
  }
```

#### TC-API-009: GET /api/v1/skills/:name 不存在
```
请求:
  GET /api/v1/skills/non-existent

预期响应 (404):
  {
    "ok": false,
    "data": null,
    "msg": "Skill not found"
  }
```

#### TC-API-010: GET /api/v1/skills/:name/download 下载
```
请求:
  GET /api/v1/skills/pdf-tool/download

预期响应 (200):
  - Content-Type: application/zip
  - Content-Disposition: attachment; filename="pdf-tool.zip"
  - Body: <ZIP binary data>
```

#### TC-API-011: POST /api/v1/skills 上传
```
请求:
  POST /api/v1/skills
  Content-Type: multipart/form-data
  Body: file=@pdf-tool.zip

预期响应 (201):
  {
    "ok": true,
    "data": { "name": "pdf-tool", ... },
    "msg": "Skill published successfully"
  }
```

#### TC-API-012: POST /api/v1/skills 上传无效 ZIP
```
请求:
  POST /api/v1/skills
  Content-Type: multipart/form-data
  Body: file=@invalid.zip

预期响应 (400):
  {
    "ok": false,
    "data": null,
    "msg": "Invalid skill: SKILL.md is required"
  }
```

#### TC-API-013: POST /api/v1/skills 重复上传
```
请求:
  POST /api/v1/skills
  Body: file=@pdf-tool.zip (已存在)

预期响应 (409):
  {
    "ok": false,
    "data": null,
    "msg": "Skill already exists"
  }
```

#### TC-API-014: DELETE /api/v1/skills/:name 删除
```
请求:
  DELETE /api/v1/skills/pdf-tool

预期响应 (200):
  {
    "ok": true,
    "data": null,
    "msg": "Skill deleted successfully"
  }
```

#### TC-API-015: DELETE /api/v1/skills/:name 无权限
```
请求:
  DELETE /api/v1/skills/other-user-skill

预期响应 (403):
  {
    "ok": false,
    "data": null,
    "msg": "Permission denied"
  }
```

#### TC-API-016: GET /api/v1/users/me/skills 我的发布
```
请求:
  GET /api/v1/users/me/skills

预期响应 (200):
  {
    "ok": true,
    "data": {
      "skills": [...],
      "total": 5
    },
    "msg": ""
  }
```

#### TC-API-017: GET /api/v1/health 健康检查
```
请求:
  GET /api/v1/health

预期响应 (200):
  {
    "ok": true,
    "data": {
      "status": "healthy",
      "version": "1.0.0",
      "uptime": 3600
    },
    "msg": ""
  }
```

---

## Web UI 测试用例

### 登录页

#### TC-UI-001: 登录成功
```
步骤:
  1. 输入 API Key
  2. 点击 "Login"
预期结果:
  - 跳转到 /skills 市场页
  - 显示用户信息
```

#### TC-UI-002: 登录失败
```
步骤:
  1. 输入无效 API Key
  2. 点击 "Login"
预期结果:
  - 显示错误提示 "Invalid API key"
```

---

### Skill 市场页

#### TC-UI-003: 列表加载
```
步骤:
  1. 访问 /skills
预期结果:
  - 显示 Skill 卡片列表
  - 每卡片: 名称、描述、下载量
```

#### TC-UI-004: 搜索
```
步骤:
  1. 在搜索框输入 "pdf"
  2. 点击搜索或回车
预期结果:
  - 显示过滤后的列表
```

#### TC-UI-005: 分页
```
步骤:
  1. 查看列表底部
预期结果:
  - 显示分页控件
  - 点击页码加载对应数据
```

---

### Skill 详情页

#### TC-UI-006: 查看详情
```
步骤:
  1. 点击 Skill 卡片
预期结果:
  - 跳转到 /skills/[name]
  - 显示完整信息
  - 显示下载按钮
```

#### TC-UI-007: 下载 Skill
```
步骤:
  1. 在详情页点击 "Download"
预期结果:
  - 下载 ZIP 文件
  - 解压到 data/skills/
  - 显示成功提示
```

---

### 我的发布页

#### TC-UI-008: 查看我的发布
```
步骤:
  1. 访问 /my-skills
预期结果:
  - 显示当前用户发布的 Skills
  - 显示删除按钮
```

#### TC-UI-009: 删除 Skill
```
步骤:
  1. 点击删除按钮
  2. 确认删除
预期结果:
  - 从列表移除
  - 服务端删除
```

---

### 上传页

#### TC-UI-010: 上传 Skill
```
步骤:
  1. 访问 /my-skills/upload
  2. 选择本地 Skill 目录
  3. 点击 "Upload"
预期结果:
  - 验证格式
  - 上传到服务端
  - 显示成功提示
```

#### TC-UI-011: 上传无效 Skill
```
步骤:
  1. 选择无效目录
  2. 点击 "Upload"
预期结果:
  - 显示验证错误
```

---

## Skill 格式验证测试

### SKILL.md 验证

#### TC-FMT-001: SKILL.md 必填
```
输入: Skill 目录无 SKILL.md
预期: 验证失败 "SKILL.md is required"
```

#### TC-FMT-002: name 必填
```
输入: SKILL.md 无 name 字段
预期: 验证失败 "name is required"
```

#### TC-FMT-003: name 格式
```
输入: name: "PDF-Tool" (大写)
预期: 验证失败 "name must be lowercase with hyphens only"
```

#### TC-FMT-004: name 连字符
```
输入: name: "pdf--tool" (双连字符)
预期: 验证失败 "name cannot contain consecutive hyphens"
```

#### TC-FMT-005: description 必填
```
输入: SKILL.md 无 description
预期: 验证失败 "description is required"
```

#### TC-FMT-006: description 长度
```
输入: description 超过 1024 字符
预期: 验证失败 "description must be 1024 characters or less"
```

#### TC-FMT-007: compatibility 长度
```
输入: compatibility 超过 500 字符
预期: 验证失败 "compatibility must be 500 characters or less"
```

#### TC-FMT-008: metadata 格式
```
输入: metadata 为非对象
预期: 验证失败 "metadata must be an object"
```

#### TC-FMT-009: allowedTools 格式
```
输入: allowedTools 为数组而非空格分隔字符串
预期: 验证失败 "allowedTools must be a space-delimited string"
```

### ZIP 包验证

#### TC-ZIP-001: ZIP 包解压
```
输入: pdf-tool.zip (内容无顶层目录)
预期: 解压到 pdf-tool/ 目录
```

#### TC-ZIP-002: ZIP 包顶层目录
```
输入: pdf-tool.zip (顶层有 pdf-tool/ 目录)
预期: 验证失败 "ZIP must not contain top-level directory"
```

#### TC-ZIP-003: ZIP 包损坏
```
输入: 损坏的 ZIP 文件
预期: 验证失败 "Invalid ZIP file"
```

---

## 测试数据

### 测试用户
| Name | API Key | 备注 |
|------|---------|------|
| testuser | test-api-key-001 | 普通用户 |
| admin | admin-api-key-001 | 管理员 |

### 测试 Skill
| Name | 目录 | 备注 |
|------|------|------|
| pdf-tool | data/skills/pdf-tool/ | 完整 Skill |
| github-tool | data/skills/github-tool/ | 完整 Skill |
| invalid-skill | data/skills/invalid-skill/ | 缺 SKILL.md |
| bad-name-skill | data/skills/bad-name-skill/ | name 格式错误 |

### 测试文件
| File | Path | 备注 |
|------|------|------|
| pdf-tool.zip | /tmp/pdf-tool.zip | 有效 ZIP |
| invalid.zip | /tmp/invalid.zip | 无 SKILL.md |
