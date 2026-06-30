# Agent / Knowledge 管理 UX 重设计

- 日期：2026-06-30
- 作者：刘锟 + Claude
- 状态：设计定稿，待评审
- 关联：`AGENTS.md`、`backend/AGENTS.md`、`docs/superpowers/specs/2026-06-30-knowledge-binding-dimension-design.md`、`README.md`

## 1. 背景与动机

当前 Web 后台（`backend/src/app/(dashboard)/`）的 Agent / Knowledge 管理界面存在三类问题：

1. **Agent 创建/维护拥挤**：`agents/page.tsx`（1114 行）采用「左侧卡片墙 + 右侧 480px 固定面板」，面板里塞了一个 3 步向导（基本信息→能力→知识）。绑定 skills/knowledge 在向导第 2/3 步，每步把搜索框、「已选择」列表、「可选」滚动列表、「创建新能力/知识」嵌套弹窗全挤在 480px 内。30+ 个 `useState` 堆在同一文件。
2. **Knowledge 太简单且割裂**：`knowledges/page.tsx` 页面**没有「创建知识」按钮**，知识只能从 Agent 绑定流程里建；详情卡只读，编辑是独立弹窗，且仅 ADMIN 可编辑。
3. **模式不统一**：Agent 用卡片网格 + 向导；Skill / Knowledge 用表格 + 右侧卡片。三种资源三套交互。

根因：创建 / 编辑 / 绑定三件事全压在一个窄面板里，且资源间缺乏一致的交互语言。

诉求：让 **Agent / Knowledge 的创建与维护清晰、简洁、高效**，绑定界面不再拥挤。

## 2. 目标与非目标

### 目标
1. Agent 创建/编辑改为**全屏编辑页**（左右两栏），绑定区有充足空间。
2. Knowledge **升级为一等公民**：页面有「创建」入口，配独立创建/编辑页，CRUD 体验与 Agent 统一。
3. 绑定交互改为「**已绑清单 + 添加选择器**」，管理已绑与添加新项彻底分离。
4. 列表页统一为**卡片墙**模式（Agent + Knowledge）。
5. 顺带拆分 1114 行单文件，按职责切分为小而清晰的组件。

### 非目标（明确不做）
- 不动 Skill 资源页（`/skills` 保持表格 + 详情卡 + 上传页）；仅在绑定选择器里优化其展示与搜索。
- 不改绑定的 **append-only / 版本语义**数据模型（`AGENTS.md` §6.3）；版本语义对用户保持透明。
- 不引入 RAG / 检索配置 UI（`retrievalConfig` 继续休眠，见知识飞轮 v1 设计）。
- 不做响应式移动端适配（仍以桌面端为主，但布局不刻意破坏窄屏可用性）。

### 范围边界
- **前端为主**：改 `backend/src/app/(dashboard)/` 下页面与组件，复用现有 REST API。
- **少量后端微调**：仅在发现字段缺口时才补；预计零改动（现有 `POST/PATCH /api/v1/knowledges`、`POST/DELETE /api/v1/agents/:id/{skills,knowledges}` 已够用）。

## 3. 决策摘要（已与用户确认）

| 维度 | 决策 |
|---|---|
| 范围 | 前端为主 + 少量后端微调 |
| Agent 编辑 | 全屏编辑页 |
| Knowledge | 升级一等公民，与 Agent 统一 |
| 绑定交互 | 已绑清单 + 添加选择器 |
| Skill | 保持现状，只优化选择体验 |
| 编辑页排版 | 左右两栏（左基本信息，右绑定） |

## 4. 信息架构（路由）

把「列表页内嵌面板/向导」拆为职责单一的页面：

| 路由 | 职责 |
|---|---|
| `/agents` | 列表（卡片墙）+ 搜索；点卡片 → 详情；「新建」→ `/agents/new` |
| `/agents/new` | 创建编辑器（两栏） |
| `/agents/[id]` | **详情页**（只读）：描述 / Prompt 预览 / 已绑能力·知识 / 元信息；操作：编辑·下载·删除 |
| `/agents/[id]/edit` | 编辑编辑器（复用 new 的组件，预填） |
| `/knowledges` | 列表（卡片墙，**由表格改为卡片**）+ 搜索 + 标签筛选 |
| `/knowledges/new` | 创建编辑器 |
| `/knowledges/[id]` | 详情页（只读）：描述 / 标签 / Markdown 渲染 / 元信息；操作：编辑·（管理员）删除 |
| `/knowledges/[id]/edit` | 编辑编辑器 |
| `/skills` | **不动** |

**详情页与编辑页分离**：详情=看，编辑=改，符合直觉、避免误改。新建与编辑共用同一个 `Editor` 组件，靠是否带初始数据区分模式。

## 5. 列表页（Agent & Knowledge 统一卡片墙）

- **顶栏**：标题 + 「新建」主按钮 + 搜索框（输入防抖 300ms）+（知识）`TagFilter` 标签筛选
- **卡片**：
  - Agent：头像、名称、描述（2 行截断）、状态徽标、版本、能力·知识计数（沿用现有 `skillsCount/knowledgesCount`）
  - Knowledge：图标、名称、描述、标签、更新时间、发布人
- 交互：点卡片 → 详情页；空态、加载骨架沿用现有视觉

## 6. 编辑器页（核心 · 左右两栏）

通用顶栏：标题（新建员工 / 编辑：xxx）+ [取消] + [保存]（有变更才可点；行内校验）。

### 6.1 Agent 编辑器

```
┌ 编辑 Agent：智能客服 ─────────── [取消] [保存] ┐
├───────────────────┬───────────────────────────┤
│ 基本信息           │ 能力 (3)          [+ 添加] │
│ 姓名  [_________]  │ ┌────────────────────────┐│
│ 描述  [_________]  │ │✨ 天气查询   天气  [×] ││
│ 头像  [ avatar  ]  │ │✨ 邮件发送   通讯  [×] ││
│ Prompt[________]   │ │✨ 文档检索   RAG   [×] ││
│       [________]   │ └────────────────────────┘│
│ 版本  [1.0.0___]   │ 知识 (2)          [+ 添加] │
│ 状态  (•)启用      │ ┌────────────────────────┐│
│                   │ │📖 产品介绍  必备  [×]  ││
│                   │ │📖 FAQ       经验  [×]  ││
│                   │ └────────────────────────┘│
└───────────────────┴───────────────────────────┘
```

- **左栏·基本信息**：姓名*、头像（复用 `AvatarPicker`）、描述、Prompt*、版本、状态（启用/停用 radio）
- **右栏·绑定**：
  - `能力 (n)` + `[+ 添加能力]` → `SkillPickerDialog`；下方 `BoundSkillList`（行：图标·名·描述·[×]）
  - `知识 (n)` + `[+ 添加知识]` → `KnowledgePickerDialog`；下方 `BoundKnowledgeList` 按 essential/experience 分组着色，每行带 `KindToggle`（改为必备/经验）+ [×]；essential > 5 给「必备过多会拖慢启动」提示（沿用现有文案）

### 6.2 Knowledge 编辑器

```
┌ 编辑知识：公司产品介绍 ───────── [取消] [保存] ┐
├───────────────────┬───────────────────────────┤
│ 名称  [_________]  │  预览                      │
│ 描述  [_________]  │  ┌──────────────────────┐ │
│ 标签  [tag][tag+]  │  │ # 产品介绍            │ │
│ 内容  [Markdown  ]  │  │ ...实时渲染...        │ │
│       [编辑区    ]  │  │                      │ │
└───────────────────┴───────────────────────────┘
```

- **左栏**：名称*、描述、`TagInput`（替换现在的逗号分隔文本框，做成真正的标签输入：回车/逗号添加、× 删除）、内容*（Markdown textarea）
- **右栏**：内容实时预览（复用 `ReactMarkdown`）

## 7. 绑定选择器（SkillPickerDialog / KnowledgePickerDialog）

通用 `Dialog`（参数化复用，区分 skill / knowledge）：

```
点 [+ 添加能力] →
┌─ 选择能力 ──────────── [搜索________] ────┐
│ ☑ 天气查询     天气/地理                   │
│ ☐ 翻译服务     多语言                      │
│ ☐ 日程管理     日历                        │
│ ☐ 数据分析     报表                        │
│                                           │
│ 没有想要的？ [新建 →]（新标签页打开）        │
│                  [取消]    [添加 2 项]      │
└───────────────────────────────────────────┘
```

- 搜索框（输入防抖；skill 客户过滤 / knowledge 走 `GET /api/v1/knowledges?search=`）
- 多选勾选列表；已绑项默认勾选
- Knowledge 选择器：加入时默认 `kind = experience`，加入后在已绑清单里用 `KindToggle` 调整
- 底部 `[取消] [添加 N 项]`
- **「没有？新建」链接 → 在新标签页打开** `/skills`（上传）或 `/knowledges/new`，避免弹窗套弹窗；建完回来刷新选择器

## 8. 组件拆分（治本：拆 1114 行单文件）

遵循「小而清晰、职责单一」原则，把现有 `agents/page.tsx` / `knowledges/page.tsx` 拆为：

**编辑器主体**
- `AgentEditor`（`components/agent/agent-editor.tsx`）— Agent 两栏编辑器，新建/编辑共用
- `KnowledgeEditor`（`components/knowledge/knowledge-editor.tsx`）— Knowledge 两栏编辑器

**绑定相关**
- `ResourcePickerDialog`（`components/binding/resource-picker-dialog.tsx`）— 通用选择器，props 区分 skill/knowledge
- `BoundSkillList` / `BoundKnowledgeList`（`components/binding/`）— 已绑清单
- `KindToggle`（`components/binding/kind-toggle.tsx`）— essential/experience 切换

**通用原语（放入 `components/ui/`）**
- `TagInput` — 真正的标签输入（替换逗号文本框）
- `MarkdownEditor` — textarea + 预览切换/并排
- `ResourceCard` — 统一列表卡片
- `PageHeader` — 列表页顶栏（标题 + 新建 + 搜索）
- 复用现有 `Dialog/Card/Button/Input/AvatarPicker/TagFilter`

**数据层**
- 抽 `useAgents` / `useKnowledges` 等小 hook 收口列表/详情/搜索请求，减少页面内重复 `fetch`

**页面（路由层，瘦）**
- `agents/page.tsx`、`agents/new/page.tsx`、`agents/[id]/page.tsx`、`agents/[id]/edit/page.tsx`
- `knowledges/page.tsx`、`knowledges/new/page.tsx`、`knowledges/[id]/page.tsx`、`knowledges/[id]/edit/page.tsx`
- 页面只负责取数 + 组装组件，不堆业务逻辑

## 9. 数据流与保存语义

### Agent 保存
- 创建：`POST /api/v1/agents` → 用返回 id 调 `bindSkillsAndKnowledges`
- 编辑：`PUT /api/v1/agents/:id` → 同步绑定：拉当前已绑 skills/knowledges → 删除「已移除」的 → 增量绑定「新增/变更」的（沿用现有逻辑，**保持 append-only 透明**）
- 校验：姓名、Prompt 必填（行内提示）

### Knowledge 保存
- 创建：`POST /api/v1/knowledges`（name/description/content/tags）
- 编辑：`PATCH /api/v1/knowledges/:id`
- 编辑后若关联了 Agent：保留现有「更新关联 Agent 版本」二次确认流程（`PUT /api/v1/agents/batch-version`），UI 做得更顺
- 校验：名称、内容必填

### 后端微调（仅按需）
- 预计零改动。若发现 Knowledge 创建/编辑缺 tags 字段支持或 Skill 选择器列表接口不足，再小范围补；**不改数据模型、不改 append-only 语义**。

## 10. 错误处理与加载态
- 列表/详情：加载骨架、空态、请求失败 toast
- 编辑器：保存失败行内提示（沿用现有 `saveError` 模式）；删除前 `confirm`
- 选择器：搜索无结果空态；「新建」后回到选择器自动刷新

## 11. 验证（遵循 `AGENTS.md` 验证顺序）
- 前端无 CI / 测试框架：以 `pnpm dev` 冒烟 + 手动走查（新建/编辑/绑定/删除各路径）+ `pnpm lint` 为准
- 重点回归：Agent 创建→绑定 skill/knowledge→保存→详情展示；Knowledge 创建→编辑→关联 Agent 版本更新流程；绑定 append-only 行为不变
- `agents/page.tsx`、`knowledges/page.tsx` 拆分后，确保无回归（行为与改造前一致）

## 12. 风险与权衡
- **Knowledge 表格→卡片**牺牲列表密度（更新时间/发布人等列），换取与 Agent 的统一感；卡片仍保留关键信息。若日后条目暴增可再回退为表格视图。
- **路由变多**（每资源 4 个页面）换取每页职责单一、可分享 URL、浏览器前进后退自然；值得。
- **详情页与编辑页分离**比「单页查看/编辑切换」多一次跳转，但更清晰、防误改。
