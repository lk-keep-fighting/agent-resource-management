# 标签功能增强

## 背景
当前系统标签功能仅支持单标签筛选，且无标签管理API。需要增强标签功能以支持多标签组合筛选和管理。

## 需求
1. **多标签组合筛选** — 支持 AND/OR 模式筛选 skills
2. **标签管理API** — 创建、删除标签
3. **Knowledge 标签支持** — 为知识库添加标签功能

## 设计

### 数据模型扩展

#### Prisma Schema 变更
```prisma
model Tag {
  id        String   @id @default(uuid())
  name      String   @unique
  createdAt DateTime @default(now())

  skillTags     SkillTag[]
  knowledgeTags KnowledgeTag[]  // 新增

  @@map("tags")
}

// 新增 KnowledgeTag 中间表
model KnowledgeTag {
  knowledgeId String
  tagId       String

  knowledge Knowledge @relation(fields: [knowledgeId], references: [id], onDelete: Cascade)
  tag       Tag       @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([knowledgeId, tagId])
  @@map("knowledge_tags")
}

model Knowledge {
  ...
  knowledgeTags KnowledgeTag[]  // 新增
}
```

### API 设计

#### 1. Tags API 扩展
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/tags | 获取所有标签（支持 sort 参数） |
| POST | /api/v1/tags | 创建标签 |
| DELETE | /api/v1/tags/:id | 删除标签 |

#### 2. Skills API 筛选扩展
| 参数 | 说明 |
|------|------|
| tags | 逗号分隔的标签名列表 |
| tagMode | and 或 or（默认 or） |

#### 3. Knowledges API 扩展
- GET /api/v1/knowledges — 新增 tags 和 tagMode 参数
- POST /api/v1/knowledges — 支持 tags 字段
- PATCH /api/v1/knowledges/:id — 支持更新 tags

## 实现步骤

### 步骤 1: 数据库迁移
- [x] 创建数据库迁移文件
- [x] 添加 knowledge_tags 表
- [x] 同步到数据库

### 步骤 2: Tags API 扩展
- [x] 添加 POST /api/v1/tags 创建标签
- [x] 添加 DELETE /api/v1/tags/:id 删除标签
- [x] 支持 sort 参数（hot/recent/alpha）

### 步骤 3: Skills API 多标签筛选
- [x] 修改 GET /api/v1/skills 支持 tags 和 tagMode 参数
- [x] 实现 AND/OR 筛选逻辑

### 步骤 4: Knowledge 标签支持
- [x] 创建 /api/v1/knowledges/[id]/tags/route.ts
- [x] GET /api/v1/knowledges 支持 tags 筛选
- [x] POST /api/v1/knowledges 支持 tags 字段
- [x] PATCH /api/v1/knowledges/:id 支持 tags 更新

## 测试计划
1. 创建新标签
2. 删除标签（验证级联删除）
3. 单标签筛选 skills
4. 多标签 OR 筛选 skills
5. 多标签 AND 筛选 skills
6. 知识关联标签
7. 按标签筛选知识

## 完成状态
- [x] 数据库迁移完成
- [x] Tags API 扩展完成
- [x] Skills 多标签筛选完成
- [x] Knowledge 标签支持完成
- [x] TypeScript 编译通过