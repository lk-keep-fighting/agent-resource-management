# API Key 加密存储优化

## 背景
当前API Key生成后，用户关闭页面即无法再次查看，只能重新生成。参考GitHub PAT等主流服务，用户应能随时复制API Key。

## 需求
1. 用户可随时在页面查看和复制已生成的API Key
2. 数据库存储加密后的原始Key，而非仅存哈希
3. 安全性：使用主密钥加密存储

## 设计

### 加密方案
- **算法**: AES-256-GCM
- **主密钥**: 环境变量 `API_KEY_MASTER_KEY` (32字节hex)
- **存储**: `encryptedApiKey` 字段存储 "iv:encryptedData:tag" 格式

### 数据库变更
```prisma
model User {
  // 新增字段
  encryptedApiKey String? @map("encrypted_api_key")
}
```

### API变更
- `POST /api/v1/users/me/api-key/generate` - 返回加密存储后的原始Key
- `GET /api/v1/users/me/api-key` - 新增接口，获取当前用户的加密Key并解密返回

### 前端变更
- 新增"查看API Key"按钮
- 点击后显示/复制API Key

## 实现步骤

### 步骤 1: 数据库迁移
- [x] 修改 schema.prisma 添加 encryptedApiKey 字段
- [x] 生成并执行数据库迁移

### 步骤 2: 后端加密工具函数
- [x] 在 lib/auth.ts 添加加密/解密函数
- [x] 添加获取主密钥的函数

### 步骤 3: API Key生成接口修改
- [x] 修改 generate route 返回解密后的Key

### 步骤 4: 新增获取API Key接口
- [x] 创建 GET route 返回解密后的Key

### 步骤 5: 前端页面改造
- [x] 添加获取API Key的状态和函数
- [x] 优化UI，支持"查看"和"复制"功能
- [x] 添加"重新生成"功能

## 测试计划
1. 首次生成API Key后，刷新页面能否查看
2. 复制功能是否正常
3. 重新生成后旧Key是否失效
4. 未登录用户无法获取Key