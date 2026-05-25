# Agent 迭代更新设计方案

## 1. 设计原则

基于**开闭原则**管理 Agent：
- **Skill/Knowledge 绑定**: 只增不删，通过新版本实现迭代扩展
- **Agent 元信息**: 可直接编辑 (name, description, prompt, avatar)

## 2. 数据模型

### 2.1 Prisma Schema 变更

新增 `AgentSkillBinding` 和 `AgentKnowledgeBinding` 表：

```prisma
model AgentSkillBinding {
  id        String   @id @default(uuid())
  agentId   String
  skillId   String
  version   String   // skill 版本号
  config    Json?
  createdAt DateTime @default(now())

  agent     Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)
  skill     Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@index([agentId], name: "idx_skill_binding_agent")
  @@unique([agentId, skillId, version], name: "uq_agent_skill_version")
}

model AgentKnowledgeBinding {
  id              String   @id @default(uuid())
  agentId         String
  knowledgeId     String
  version         String
  retrievalConfig Json?
  createdAt       DateTime @default(now())

  agent           Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)
  knowledge       Knowledge @relation(fields: [knowledgeId], references: [id], onDelete: Cascade)

  @@index([agentId], name: "idx_knowledge_binding_agent")
  @@unique([agentId, knowledgeId, version], name: "uq_agent_knowledge_version")
}
```

### 2.2 移除旧表

删除原有的 `AgentSkill` 和 `AgentKnowledge` 多对多表。

## 3. API 设计

### 3.1 Agent 元信息编辑
```
PUT /api/v1/agents/:id
Body: { name?, description?, prompt?, avatar?, status? }
```

### 3.2 Skill 绑定
```
POST /api/v1/agents/:id/skills     - 新增绑定 (只增不删)
DELETE /api/v1/agents/:id/skills/:skillId - 解绑
GET /api/v1/agents/:id/bindings/history   - 查看绑定历史
```

### 3.3 Knowledge 绑定
```
POST /api/v1/agents/:id/knowledges     - 新增绑定
DELETE /api/v1/agents/:id/knowledges/:knowledgeId - 解绑
```

### 3.4 获取 Agent 当前状态
```
GET /api/v1/agents/:id
Response: {
  id, name, description, prompt, avatar, status,
  skills: [{ skillId, name, version, config }],
  knowledges: [{ knowledgeId, name, version, retrievalConfig }]
}
```

## 4. CLI 设计

### 4.1 命令
```bash
arm agent sync <folder>              # 同步 Agent
arm agent bind <name> --skill=<id> --version=<ver>  # 绑定 Skill
arm agent unbind <name> --skill=<id>                # 解绑 Skill
arm agent bindings <name> --history                 # 查看绑定历史
```

### 4.2 sync 流程
1. 解析本地文件夹
2. 对比云端 Agent 元信息差异，有变化则更新
3. 对比 Skill 绑定差异，新版本则新增绑定
4. 对比 Knowledge 绑定差异，新增则新增绑定，删除则解绑

## 5. 实现计划

### Phase 1: 服务端
- [ ] 修改 Prisma Schema
- [ ] 实现新的绑定 API
- [ ] 更新 Agent GET API 返回新格式

### Phase 2: CLI
- [ ] 实现 `arm agent sync` 命令
- [ ] 实现 `arm agent bind/unbind` 命令
- [ ] 实现 `arm agent bindings --history` 命令
