# Agent 员工化升级：岗位说明书 + KPI + 进化引擎

> 把 Agent 从"配置文件"升级为"数字员工"：填写岗位说明书、定义可量化 KPI、基于表现自动进化。

---

## 1. 背景与动机

### 1.1 现状盘点

当前 `Agent` 模型（`backend/prisma/schema.prisma:89`）只有 6 个字段：

| 字段 | 含义 | 不足 |
|------|------|------|
| `name` | 唯一名 | ✓ 够用 |
| `description` | 一句话 | ✗ 装不下"岗位职责" |
| `prompt` | System Prompt | ✗ 混了"人设"和"业务规则" |
| `avatar` | 头像 | ✓ 够用 |
| `version` | SemVer | ✓ 够用 |
| `status` | draft/active | ✗ 缺"在岗/休假/退役" |

绑定关系已有 `AgentSkillBinding` / `AgentKnowledgeBinding`，但**没有回答**：
- 这个 Agent **是干什么的**（岗位说明书）
- **怎么衡量它干得好不好**（KPI）
- **干得不好时怎么提升**（进化机制）

### 1.2 目标

像管理真实员工一样管理 Agent：
1. **JD（Job Description）**：岗位职责、任职要求、协作关系、边界、输出标准
2. **KPI**：可量化、可评估、有周期、有权重的指标体系
3. **进化引擎**：KPI 评估 → 诊断能力缺口 → 自动建议 Skill/Knowledge/Prompt 升级

### 1.3 价值

- **管理者**：填 JD 就能定岗，KPI 让"好不好"有据可查
- **使用者**：通过 JD 快速判断"这个 Agent 适不适合这个任务"
- **Agent 本身**：有明确的"成长目标"，可形成"训练-评估-改进"闭环
- **平台**：积累"岗位模型库"，未来可推荐 Agent 配比、识别冗余岗位

---

## 2. 核心概念

```
┌─────────────────────────────────────────────────────────────┐
│                       Agent 数字员工档案                     │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │  基础信息            │  │  岗位说明书 (JD)              │  │
│  │  name, avatar, ...   │  │  - 岗位/职级/部门/上级        │  │
│  └─────────────────────┘  │  - 岗位职责 (N 条)            │  │
│                           │  - 任职要求 (Skill/Knowledge) │  │
│                           │  - 工作边界                    │  │
│                           │  - 协作 Agent                  │  │
│                           │  - 输出标准 / 典型场景         │  │
│                           └─────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │  KPI 体系            │  │  进化引擎                     │  │
│  │  - 效率/质量/满意度   │  │  - KPI 诊断                   │  │
│  │  - 目标/权重/周期    │  │  - 缺口分析                   │  │
│  │  - 自动/人工采集     │  │  - 升级建议 (skill/know/prompt)│  │
│  │  - 评估记录          │  │  - 版本演进                   │  │
│  └─────────────────────┘  └─────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │  能力资产 (现状)     │  │  资源绑定 (现状)              │  │
│  │  - Skills            │  │  - AgentSkillBinding        │  │
│  │  - Knowledges        │  │  - AgentKnowledgeBinding    │  │
│  └─────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型设计

### 3.1 新增表一览

| 模型 | 关系 | 作用 |
|------|------|------|
| `AgentJobDescription` | 1-1 with Agent | 岗位说明书 |
| `AgentKpi` | 1-N with Agent | KPI 定义 |
| `AgentKpiRecord` | 1-N with AgentKpi | 评估记录（每周期一条） |
| `AgentEvolution` | 1-N with Agent | 进化事件（诊断+建议） |
| `AgentEvolutionHistory` | 1-N with Agent | 升级轨迹快照 |

### 3.2 Prisma Schema 草案

```prisma
// === 岗位说明书 ===
model AgentJobDescription {
  id                String   @id @default(uuid())
  agentId           String   @unique
  jobTitle          String   @db.VarChar(128)        // 岗位名: "高级代码评审专家"
  department        String?  @db.VarChar(128)        // 部门/团队
  level             String?  @db.VarChar(32)         // 职级: P5/P6/P7
  managerAgentId    String?                           // 上级 Agent（汇报关系）
  responsibilities  Json                             // List<string> 岗位职责
  requirements      Json                             // { skills: [...], knowledges: [...], experience: "..." }
  boundaries        Json?                            // List<string> 工作边界
  collaborators     Json?                            // List<agentId> 协作 Agent
  outputStandards   Json?                            // List<string> 输出物标准
  scenarios         Json?                            // List<string> 典型场景示例
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  agent         Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)
  managerAgent  Agent? @relation("AgentManager", fields: [managerAgentId], references: [id], onDelete: SetNull)
  subordinates Agent[] @relation("AgentManager")

  @@index([jobTitle], name: "idx_jd_job_title")
  @@index([department], name: "idx_jd_department")
  @@map("agent_job_descriptions")
}

// === KPI 定义 ===
model AgentKpi {
  id               String      @id @default(uuid())
  agentId          String
  name             String      @db.VarChar(128)        // "PR评审及时率"
  description      String?     @db.VarChar(512)
  category         String      @db.VarChar(32)         // 质量/效率/满意度/创新/合规
  type             KpiType                              // 数值/评分/布尔/比率
  unit             String?     @db.VarChar(32)         // %, 分, 次
  targetValue      Float?                              // 目标值
  warningValue     Float?                              // 预警值（低于此值告警）
  weight           Float       @default(0.1)           // 权重 0-1（团队内归一化校验）
  evaluationPeriod KpiPeriod    @default(monthly)      // 日/周/月/季
  dataSource       KpiDataSource @default(manual)      // auto/manual/hybrid
  dataConfig       Json?                               // 自动采集配置（如查询某个日志表）
  status           KpiStatus    @default(active)
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  agent   Agent            @relation(fields: [agentId], references: [id], onDelete: Cascade)
  records AgentKpiRecord[]

  @@index([agentId], name: "idx_kpi_agent")
  @@index([category], name: "idx_kpi_category")
  @@index([status], name: "idx_kpi_status")
  @@map("agent_kpis")
}

enum KpiType     { numeric  score  boolean  rate }
enum KpiPeriod   { daily  weekly  monthly  quarterly }
enum KpiDataSource { auto  manual  hybrid }
enum KpiStatus   { active  archived }

// === KPI 评估记录 ===
model AgentKpiRecord {
  id           String   @id @default(uuid())
  kpiId        String
  agentId      String
  period       String   @db.VarChar(32)                // "2026-Q2" / "2026-06" / "2026-W23"
  actualValue  Float?                                    // 实际值
  score        Float?                                    // 综合得分 0-100
  result       KpiResult @default(pending)              // achieved/warning/failed/pending
  evidence     Json?                                    // 评估依据（自动采集的原始数据）
  feedback     String?  @db.Text                        // 人工评语
  evaluatedAt  DateTime  @default(now())
  evaluatorId  String?                                   // 人工评估者 userId

  kpi       AgentKpi @relation(fields: [kpiId], references: [id], onDelete: Cascade)
  agent     Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
  evaluator User?    @relation(fields: [evaluatorId], references: [id], onDelete: SetNull)

  @@unique([kpiId, period], name: "uq_kpi_period")
  @@index([agentId], name: "idx_kpi_record_agent")
  @@index([result], name: "idx_kpi_record_result")
  @@map("agent_kpi_records")
}

enum KpiResult { pending  achieved  warning  failed }

// === 进化事件 ===
model AgentEvolution {
  id              String   @id @default(uuid())
  agentId         String
  triggerType     EvolutionTrigger                      // kpi_failed/skill_gap/manual/scheduled
  triggerRef      String?                               // 触发的 KPI 记录 ID 等
  diagnosis       Json                                  // { weakKpis, skillGaps, knowledgeGaps, promptIssues }
  suggestions     Json                                  // List<{ type, action, target, reason, priority }>
  status          EvolutionStatus @default(proposed)     // proposed/applied/rejected/superseded
  appliedActions  Json?                                 // 实际执行的动作
  createdAt       DateTime @default(now())
  appliedAt       DateTime?
  rejectedAt      DateTime?
  rejectReason    String?

  agent Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@index([agentId], name: "idx_evolution_agent")
  @@index([status], name: "idx_evolution_status")
  @@index([triggerType], name: "idx_evolution_trigger")
  @@map("agent_evolutions")
}

enum EvolutionTrigger { kpi_failed  skill_gap  manual  scheduled }
enum EvolutionStatus  { proposed  applied  rejected  superseded }

// === 升级历史快照 ===
model AgentEvolutionHistory {
  id            String   @id @default(uuid())
  agentId       String
  fromVersion   String
  toVersion     String
  evolutionId   String?
  summary       String?  @db.VarChar(512)               // "绑定 code-analysis@1.1.0; 升级 prompt"
  changes       Json                                    // { skills: [...], knowledges: [...], prompt: "diff" }
  createdAt     DateTime @default(now())

  agent Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@index([agentId], name: "idx_evolution_history_agent")
  @@index([createdAt], name: "idx_evolution_history_time")
  @@map("agent_evolution_history")
}
```

### 3.3 既有 Agent 模型补强

```prisma
model Agent {
  // ... 既有字段
  jd                AgentJobDescription?
  kpis              AgentKpi[]
  kpiRecords        AgentKpiRecord[]
  evolutions        AgentEvolution[]
  evolutionHistory  AgentEvolutionHistory[]

  // 兼容既有字段
  // prompt 字段继续保留，JD 不强制覆盖；建议在 prompt 中引用 JD 摘要
}
```

`User` 模型需新增反向关系：
```prisma
model User {
  // ... 既有字段
  kpiEvaluations AgentKpiRecord[]   // 作为评估者
}
```

### 3.4 关键约束与策略

- **KPI 唯一性**：`name` 在同一 Agent 内不重复（应用层校验）
- **KPI 权重**：建议在 `arm agent kpi validate` 时校验同 agent 权重和 ≈ 1.0（警告而非强制）
- **评估周期**：`period` 字符串格式统一（`YYYY-Qn` / `YYYY-MM` / `YYYY-Www` / `YYYY-MM-DD`）
- **进化建议**：`suggestions` 是**只读提案**，不会自动应用，必须人工 ACK
- **JD 软升级**：JD 字段全部可编辑（不像 Binding 那样只增不删），鼓励管理者持续调优
- **KPI 归档**：`status='archived'` 而非硬删除，保留历史评估

---

## 4. API 设计

### 4.1 岗位说明书

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/agents/:id/job-description` | 获取 JD |
| PUT | `/api/v1/agents/:id/job-description` | 创建/更新 JD（全量） |
| DELETE | `/api/v1/agents/:id/job-description` | 删除 JD |
| GET | `/api/v1/job-descriptions?keyword=...&department=...` | JD 检索（HR 视角） |

### 4.2 KPI

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/agents/:id/kpis` | 列出 Agent 全部 KPI |
| POST | `/api/v1/agents/:id/kpis` | 新增 KPI 定义 |
| GET | `/api/v1/agents/:id/kpis/:kpiId` | KPI 详情 |
| PUT | `/api/v1/agents/:id/kpis/:kpiId` | 更新 KPI |
| DELETE | `/api/v1/agents/:id/kpis/:kpiId` | 归档 KPI（`status='archived'`） |

### 4.3 KPI 评估

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/agents/:id/kpi-records?period=2026-Q2&kpiId=...` | 查询评估记录 |
| POST | `/api/v1/agents/:id/kpis/:kpiId/records` | 提交一次评估（auto/manual） |
| GET | `/api/v1/agents/:id/kpi-summary?period=2026-Q2` | 综合得分（按权重汇总） |

### 4.4 进化引擎

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/agents/:id/evolutions/diagnose` | 基于 KPI 触发诊断，生成建议（不应用） |
| GET | `/api/v1/agents/:id/evolutions` | 查看历史/待处理建议 |
| POST | `/api/v1/agents/:id/evolutions/:evoId/apply` | 应用建议（绑定 skill/know + 升 version） |
| POST | `/api/v1/agents/:id/evolutions/:evoId/reject` | 拒绝建议（含原因） |
| GET | `/api/v1/agents/:id/evolution-history` | 版本演进时间线 |

### 4.5 请求/响应示例

**创建 JD**：
```http
PUT /api/v1/agents/abc-123/job-description
Content-Type: application/json

{
  "jobTitle": "高级代码评审专家",
  "department": "工程效能部",
  "level": "P6",
  "managerAgentId": "tech-lead-uuid",
  "responsibilities": [
    "审查 PR 的代码质量与设计合理性",
    "识别潜在的性能、安全、可维护性问题",
    "提供可执行的修复建议"
  ],
  "requirements": {
    "skills": ["code-analysis", "security-scan"],
    "knowledges": ["java-best-practices", "design-patterns"],
    "experience": "5+ years Java 经验"
  },
  "boundaries": ["不负责编写新功能代码", "不负责部署发布"],
  "collaborators": ["test-agent-uuid", "doc-agent-uuid"],
  "outputStandards": [
    "必须按风险等级标注问题（blocker/major/minor）",
    "给出可执行的修复建议或示例代码"
  ],
  "scenarios": [
    "评审 Java 微服务的 PR",
    "评审前端 React 组件"
  ]
}
```

**提交 KPI 评估**：
```http
POST /api/v1/agents/abc-123/kpis/kpi-uuid/records
Content-Type: application/json

{
  "period": "2026-Q2",
  "actualValue": 87.5,
  "evidence": { "totalPrs": 120, "reviewedIn24h": 105 },
  "feedback": "整体表现稳定，但复杂重构类 PR 的评审深度仍需提升",
  "evaluatorId": "user-uuid"   // 人工评估时必填
}
```

**触发进化诊断**：
```http
POST /api/v1/agents/abc-123/evolutions/diagnose
→ 200 OK
{
  "evolutionId": "evo-uuid",
  "diagnosis": {
    "weakKpis": ["kpi-uuid-1", "kpi-uuid-2"],
    "skillGaps": ["security-scan"],
    "knowledgeGaps": ["advanced-java-concurrency"],
    "promptIssues": ["缺乏对大型重构 PR 的审查指导"]
  },
  "suggestions": [
    { "type": "bind_skill", "target": "security-scan", "version": "1.0.0", "reason": "覆盖率仅 60% 触发", "priority": "high" },
    { "type": "bind_knowledge", "target": "advanced-java-concurrency", "version": "1.0.0", "reason": "复杂 PR 评审深度不足", "priority": "medium" },
    { "type": "update_prompt", "target": "...", "reason": "补充复杂 PR 审查指引", "priority": "medium" }
  ]
}
```

---

## 5. CLI 设计

```bash
# 岗位说明书
arm agent jd <name>                                # 查看 JD
arm agent jd <name> --edit                         # 本地编辑 JD.md 后上传
arm agent jd export <name> --out=JD.md             # 导出 JD 为本地 Markdown
arm agent jd import <name> JD.md                   # 从 Markdown 导入

# KPI
arm agent kpi ls <name>                            # 列出 KPI
arm agent kpi add <name> --name=... --type=rate --target=95 --weight=0.3
arm agent kpi show <name> <kpi-name>
arm agent kpi update <name> <kpi-id>
arm agent kpi archive <name> <kpi-id>              # 软删除

# KPI 评估
arm agent kpi record <name> <kpi-id> --period=2026-Q2 --value=87.5 --feedback="..."
arm agent kpi summary <name> --period=2026-Q2      # 加权综合得分

# 进化
arm agent evolve diagnose <name>                   # 触发诊断
arm agent evolve apply <name> <evo-id>             # 应用建议（自动绑定+升 version）
arm agent evolve reject <name> <evo-id> --reason="..."
arm agent history <name>                           # 查看升级时间线
```

### 本地文件格式

`AGENT.md` 扩展 frontmatter：

```yaml
---
name: code-reviewer
version: 1.0.0
description: 专业代码评审 Agent
jobDescription:
  jobTitle: 高级代码评审专家
  department: 工程效能部
  level: P6
  manager: tech-lead
  responsibilities:
    - 审查 PR 的代码质量与设计合理性
    - 识别潜在的性能、安全、可维护性问题
    - 提供可执行的修复建议
  requirements:
    skills: [code-analysis, security-scan, refactoring]
    knowledges: [java-best-practices, design-patterns]
    experience: 5+ years
  boundaries:
    - 不负责编写新功能代码
    - 不负责部署和发布
  collaborators: [test-agent, doc-agent]
  outputStandards:
    - 必须按风险等级标注问题
    - 给出可执行的修复建议
  scenarios:
    - 评审 Java 微服务 PR
    - 评审前端 React 组件
kpis:
  - name: PR评审及时率
    category: 效率
    type: rate
    target: 95
    unit: '%'
    weight: 0.3
    period: monthly
    dataSource: auto
  - name: 问题识别准确率
    category: 质量
    type: rate
    target: 85
    unit: '%'
    weight: 0.5
    period: monthly
    dataSource: hybrid
  - name: 用户满意度
    category: 满意度
    type: score
    target: 4.5
    unit: '分/5分'
    weight: 0.2
    period: monthly
    dataSource: manual

prompt: |
  You are a senior code reviewer...
---
```

---

## 6. 进化引擎设计

### 6.1 诊断流程

```
              ┌──────────────┐
              │  触发诊断     │
              └──────┬───────┘
                     ▼
        ┌────────────────────────┐
        │ 1. 拉取最近 N 期 KPI   │
        │    记录，按权重汇总得分  │
        └────────────┬───────────┘
                     ▼
        ┌────────────────────────┐
        │ 2. 识别短板 KPI        │
        │    result ∈ {failed,   │
        │              warning}  │
        └────────────┬───────────┘
                     ▼
        ┌────────────────────────┐
        │ 3. 能力缺口分析         │
        │    JD.requirements vs  │
        │    当前绑定             │
        └────────────┬───────────┘
                     ▼
        ┌────────────────────────┐
        │ 4. 生成升级建议         │
        │    - bind_skill        │
        │    - bind_knowledge    │
        │    - update_prompt     │
        │    - archive_kpi       │
        └────────────┬───────────┘
                     ▼
        ┌────────────────────────┐
        │ 5. 输出 Evolution      │
        │    status=proposed     │
        └────────────────────────┘
```

### 6.2 缺口分析算法（V1 规则版）

```typescript
function diagnoseGap(agent: Agent, jd: JobDescription, kpis: Kpi[]) {
  const weakKpis = kpis.filter(k => k.latestRecord?.result in ['failed', 'warning']);

  // 1) JD 要求的 Skill/Knowledge vs 当前绑定
  const requiredSkillNames = new Set(jd.requirements.skills ?? []);
  const requiredKnowledgeNames = new Set(jd.requirements.knowledges ?? []);

  const boundSkillNames = new Set(agent.skills.map(s => s.skill.name));
  const boundKnowledgeNames = new Set(agent.knowledges.map(k => k.knowledge.name));

  const skillGaps = [...requiredSkillNames].filter(s => !boundSkillNames.has(s));
  const knowledgeGaps = [...requiredKnowledgeNames].filter(k => !boundKnowledgeNames.has(k));

  // 2) 按 weakKpis 推断附加需求（V1 用规则映射）
  const additionalSkills = weakKpis
    .filter(k => k.name.includes('性能'))
    .flatMap(k => ['performance-profiling']);

  // 3) Prompt 问题：调用 LLM 比对 prompt 和 JD.responsibilities，输出 diff
  const promptIssues = llmDiff(prompt, jd.responsibilities);

  return { weakKpis, skillGaps: [...new Set([...skillGaps, ...additionalSkills])], knowledgeGaps, promptIssues };
}
```

### 6.3 应用升级

`POST /evolutions/:evoId/apply` 内部执行：
1. 对每条 `bind_skill` / `bind_knowledge` 建议 → 调用既有 `POST /agents/:id/skills` / `knowledges`
2. 对 `update_prompt` 建议 → 调用 `PUT /agents/:id`
3. **提升 Agent.version**：应用 ≥1 条强建议时 minor+1；只应用 prompt 调整时 patch+1
4. 写 `AgentEvolutionHistory` 快照
5. 更新 `AgentEvolution.status='applied'`，记录 `appliedActions`

### 6.4 自动化数据采集（V2）

`dataSource='auto'` 的 KPI 在 `POST .../records` 时：
- 接收 `dataConfig`（如 `{ source: 'platform_log', query: 'SELECT count(*) WHERE ...' }`）
- V1：由平台侧的 ETL 任务写入 `evidence` + `actualValue`
- V2：可对接 ARM 自身的 `arm agent run` 监控埋点

---

## 7. Web UI 改造

`(dashboard)/agents/` 下：
- **Agent 列表**：增加 `岗位 / 部门 / 综合得分` 列
- **Agent 详情 Tab**：
  - 概览：基础信息 + JD 摘要
  - **岗位说明书**：可视化编辑器（独立 Tab，类 Notion 表单）
  - **KPI 仪表盘**：雷达图 + 周期趋势 + 加权得分
  - **能力资产**：现有 Skill/Knowledge 绑定
  - **进化记录**：时间线（谁、何时、为何升级）
- **JD 检索页（HR 视角）**：跨 Agent 检索岗位、部门、职级

---

## 8. 实施步骤

### Phase 1：Schema 与基础读写
- [ ] 1.1 `prisma/schema.prisma` 新增 5 张表 + Agent/User 关系补强
- [ ] 1.2 `pnpm prisma generate && pnpm prisma db push`
- [ ] 1.3 `backend/src/lib/types.ts` 新增 JD / KPI / Evolution 类型
- [ ] 1.4 实现 `agents/[id]/job-description` CRUD API
- [ ] 1.5 实现 `agents/[id]/kpis` CRUD API
- [ ] 1.6 实现 `agents/[id]/kpis/:kpiId/records` POST/GET
- [ ] 1.7 既有 `arm agent create/update` 兼容 JD 字段（透传）

### Phase 2：CLI 与本地文件
- [ ] 2.1 `cli/src/lib/validate.ts` 扩展 `validateAgentDir` 解析 JD + KPI frontmatter
- [ ] 2.2 `cli/src/cmd/agent.ts` 新增 `arm agent jd/kpi/evolve` 命令族
- [ ] 2.3 `cli/src/lib/client.ts` 新增对应 ApiClient 方法
- [ ] 2.4 `arm agent sync` 增量同步 JD/KPI
- [ ] 2.5 `arm agent jd export/import` 命令

### Phase 3：进化引擎
- [ ] 3.1 `POST /agents/:id/evolutions/diagnose`：基于规则的 V1 诊断
- [ ] 3.2 `POST /agents/:id/evolutions/:evoId/apply`：应用建议+升 version+写历史
- [ ] 3.3 `GET /agents/:id/kpi-summary?period=...`：加权汇总
- [ ] 3.4 `arm agent evolve diagnose/apply/reject` CLI

### Phase 4：Web UI
- [ ] 4.1 JD 可视化编辑表单
- [ ] 4.2 KPI 列表 + 雷达图组件
- [ ] 4.3 进化时间线组件
- [ ] 4.4 JD 检索页（HR 视角）

### Phase 5：自动化与对接（V2）
- [ ] 5.1 `dataSource='auto'` 的 ETL 接入点（先预留接口）
- [ ] 5.2 定时任务：每月初自动评估上期 KPI
- [ ] 5.3 阈值告警：综合得分 < warning 时通知管理者
- [ ] 5.4 LLM Prompt 优化建议（V2 增强）

---

## 9. 与既有设计的兼容性

- **Agent.name 唯一约束不变**；JD 独立存储
- **AgentSkillBinding / AgentKnowledgeBinding 开闭原则不变**；进化建议复用既有 API
- **Agent.version SemVer 不变**；进化时自动 bump
- **arm agent sync 流程不变**；扩展支持 JD/KPI 字段同步
- **既有数据零迁移**：新增表都允许空值，老 Agent 不补 JD/KPI 也能正常工作
- **Dashboard 兼容**：未填写 JD 的 Agent 在列表显示"未填写岗位"

---

## 10. 测试计划

1. **单元测试**（vitest / bun:test）
   - 缺口分析算法各种组合
   - KPI 综合得分加权计算
   - period 格式化与解析
2. **API 集成测试**
   - JD 全量更新覆盖
   - KPI 唯一性（同 agent 内 name 不重复）
   - `apply` 后的 version 升号 + history 记录
3. **CLI E2E**
   - `jd export` → 改本地 MD → `jd import` 一致性
   - `evolve diagnose` → `apply` 后 `info` 看到新绑定与新 version
4. **文档示例**
   - 提供完整可运行的 `code-reviewer` 示例

---

## 11. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| KPI 定义过于主观 | 评估失真 | V1 提供 KPI 模板库（PR评审、客服、数据查询等典型岗位） |
| 自动数据采集接入复杂 | KPI 长期无数据 | V1 先支持 manual；auto 留接口 |
| 进化引擎建议质量低 | 用户失去信任 | V1 规则版保守；提供"建议 diff"让人工确认；支持 reject 反馈 |
| 老 Agent 缺 JD 影响列表展示 | 体验下降 | 列表显示"未填写岗位"+ 引导填写 |
| 多次诊断产生 Evolution 堆积 | 状态管理复杂 | 状态机：proposed→applied/rejected/superseded；新诊断自动 supersede 同类 proposed |

---

## 12. 已确认的设计决策

| 议题 | 决策 | 影响 |
|------|------|------|
| 第一期范围 | **只出设计稿**，不写代码 | 本次仅交付 PLAN.md，进入实现前需用户再次 ack |
| KPI 数据源 | **V1 只支持 manual / hybrid**，auto 留接口不做 | Phase 1-2 表结构保留 `KpiDataSource.auto`，但执行器与 ETL 留待 V2 |
| 进化建议范围 | **Skill + Knowledge + Prompt 三类都做** | Phase 3 诊断器三类建议并行输出；Prompt 建议由规则版 V1 生成，LLM 调优放 V2 |
| Web UI 优先级 | **CLI 先行，UI 跟随** | Phase 1-3 不动 React；Phase 4 才补可视化编辑与雷达图 |

## 13. 完成状态

- [x] **设计稿（本次交付）**
- [ ] Phase 1: Schema 与基础读写（待开工 ack）
- [ ] Phase 2: CLI 与本地文件
- [ ] Phase 3: 进化引擎
- [ ] Phase 4: Web UI
- [ ] Phase 5: 自动化与对接
- [ ] TypeScript 编译通过（`pnpm typecheck` + `bun run typecheck`）
- [ ] 示例 Agent 端到端可跑通
- [ ] 文档同步更新（`docs/DESIGN.md` / `AGENTS.md` / `cli/AGENTS.md`）
