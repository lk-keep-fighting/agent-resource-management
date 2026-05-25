# Agent 迭代更新变更报告

**日期**: 2026-05-25
**版本**: v2.2.0

**相关文档**:
- 设计方案: [agent-iteration-design.md](./agent-iteration-design.md)

---

## 一、变更总结

### 1.1 服务端改动

#### 1.1.1 数据库 Schema 变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `prisma/schema.prisma` | 重命名 + 新增字段 | `AgentSkill` → `AgentSkillBinding` |
| | | `AgentKnowledge` → `AgentKnowledgeBinding` |
| | | 新增 `version` 字段 (版本号) |
| | | 新增 `deletedAt` 字段 (软删除) |
| | | 新增唯一约束 `(agentId, skillId, version)` |
| | | 新增唯一约束 `(agentId, knowledgeId, version)` |

#### 1.1.2 API 改动

| 接口 | 方法 | 变更 |
|------|------|------|
| `/api/v1/agents/:id/skills` | POST | 支持版本化绑定，version 缺省自动分配新版本 |
| `/api/v1/agents/:id/skills` | DELETE | 支持按 version 解绑，缺省解绑所有版本 |
| `/api/v1/agents/:id/knowledges` | POST | 支持版本化绑定，version 缺省自动分配新版本 |
| `/api/v1/agents/:id/knowledges` | DELETE | 支持按 version 解绑，缺省解绑所有版本 |
| `/api/v1/agents/:id/bindings/history` | GET | **新增**，返回完整绑定历史 |
| `/api/v1/agents/:id` | GET | 返回格式增加 `version` 字段 |

### 1.2 CLI 改动

| 命令 | 变更类型 | 说明 |
|------|----------|------|
| `arm agent sync <folder>` | **新增** | 同步本地文件夹到云端 Agent |
| `arm agent bind` | 增强 | 支持 `--skill` / `--knowledge`，version 缺省自动分配 |
| `arm agent unbind` | 增强 | 支持 `--version` 参数 |

---

## 二、设计合理性评估

### 2.1 开闭原则实现

| 组件 | 扩展方式 | 评价 |
|------|----------|------|
| Skill 绑定 | 新增绑定记录，保留历史版本 | ✅ 符合开闭原则 |
| Knowledge 绑定 | 新增绑定记录，保留历史版本 | ✅ 符合开闭原则 |
| Agent 元信息 | 可直接编辑 | ✅ 符合预期 |

### 2.2 数据模型设计

**优点**：
1. `version` 字段明确标识绑定版本，便于追溯
2. `deletedAt` 软删除设计，支持误操作恢复
3. 唯一约束 `(agentId, componentId, version)` 防止重复绑定

**可改进点**：
- 缺少 `updatedAt` 字段（绑定记录创建后不可修改，符合设计但可能需要）

### 2.3 API 设计

**优点**：
1. 版本号缺省时自动分配，降低使用复杂度
2. DELETE 支持按 version 选择性解绑
3. 新增 `/bindings/history` 接口支持完整历史查询

**可改进点**：
- 暂无批量绑定/解绑接口（未来扩展）

---

## 三、扩展性评估

### 3.1 向后兼容

| 场景 | 兼容性 | 说明 |
|------|--------|------|
| 旧版 CLI 调用新版 API | ⚠️ 部分 | API 新增 version 可选参数，兼容旧调用 |
| 新版 CLI 调用旧版 API | ❌ | 需同步升级 |
| 存量数据迁移 | ⚠️ 需迁移 | 现有绑定数据无 version，需执行迁移脚本 |

### 3.2 扩展预留

| 扩展点 | 当前支持 | 未来扩展方向 |
|--------|----------|-------------|
| 绑定配置 | `config` JSON 字段 | 可扩展为独立配置表 |
| 绑定历史 | `createdAt` + `deletedAt` | 可增加变更原因字段 |
| 版本策略 | 自动递增 patch | 可支持 major.minor 指定 |
| 批量操作 | 单条操作 | 可增加批量绑定接口 |

### 3.3 扩展性评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 数据模型扩展 | ⭐⭐⭐⭐ | 唯一约束设计良好，字段预留充分 |
| API 扩展 | ⭐⭐⭐⭐ | RESTful 设计，易于扩展 |
| CLI 扩展 | ⭐⭐⭐⭐ | 命令结构清晰，易于新增子命令 |

---

## 四、兼容性评估

### 4.1 数据库兼容性

**迁移脚本**: `prisma/migrations/20260525000000_agent_binding_versioning/migration.sql`

需要手动执行：
```bash
mysql -h dev.aimstek.cn -P 31910 -u root -p agent_skill_system \
  < prisma/migrations/20260525000000_agent_binding_versioning/migration.sql
```

**兼容性风险**：
- 现有 `agent_skills` 和 `agent_knowledge` 表将重命名
- 存量数据 `version` 字段默认为 `1.0.0`
- 建议在测试环境验证后再执行生产环境

### 4.2 API 兼容性

| 变更 | 兼容性影响 |
|------|------------|
| 新增 `version` 可选参数 | ✅ 向后兼容 |
| 返回格式增加字段 | ✅ 向后兼容 |
| 删除接口行为不变 | ✅ 兼容 |

### 4.3 CLI 兼容性

| 命令 | 兼容性说明 |
|------|------------|
| `arm agent sync` | ✅ 新增命令，无影响 |
| `arm agent bind` | ⚠️ 参数格式变化，旧版 usage 失效 |
| `arm agent unbind` | ⚠️ 参数格式变化，旧版 usage 失效 |

---

## 五、待完成事项

- [ ] 执行数据库迁移脚本
- [ ] 验证旧版 API 调用兼容性
- [ ] 更新 API 文档

---

## 六、文件变更清单

### 设计文档
```
docs/
├── agent-iteration-design.md        # 迭代更新设计方案
└── CHANGE_LOG_v2.2.0.md            # 本变更报告
```

### 服务端
```
backend/
├── prisma/
│   └── schema.prisma                                    # Schema 更新
├── prisma/migrations/
│   └── 20260525000000_agent_binding_versioning/
│       └── migration.sql                               # 新增迁移脚本
└── src/app/api/v1/agents/[id]/
    ├── skills/route.ts                                 # 技能绑定 API 重构
    ├── knowledges/route.ts                            # 知识绑定 API 重构
    ├── bindings/history/route.ts                       # 新增
    └── route.ts                                       # GET 返回格式更新
```

### CLI
```
cli/src/
├── cmd/
│   └── agent.ts                                       # 新增 syncAgent, parseLocalSkills/Knowledges
├── lib/
│   └── client.ts                                      # 绑定方法签名更新
└── main.ts                                           # 命令路由更新
```
