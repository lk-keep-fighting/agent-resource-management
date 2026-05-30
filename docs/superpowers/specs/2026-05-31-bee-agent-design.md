# Bee Agent 设计方案

## 1. 系统定位

bee是一个CLI形态的Agent编排器，使命是**建立arm Agent员工管理与执行的完整闭环**。

```
┌─────────────────────────────────────────────────────────────┐
│                        bee                                  │
│                                                             │
│  ┌───────────────┐    ┌───────────────┐   ┌─────────────┐ │
│  │   Agent员工    │    │   能力桥接层    │   │  执行框架    │ │
│  │   管理(arm)   │───▶│  (能力映射)    │──▶│pi-coding/   │ │
│  └───────────────┘    └───────────────┘   │Hermes       │ │
│                                          └─────────────┘ │
│                                                             │
│  用户交互 → Agent选择 → 能力映射 → 执行调度 → 结果反馈       │
└─────────────────────────────────────────────────────────────┘
```

**核心价值**：
- 让arm中的Agent员工真正"活"起来，可以被调用执行任务
- 统一Agent员工格式与不同执行框架的差异
- 提供企业级的Agent员工管理和执行体验

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLI交互层                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   REPL       │  │   命令解析    │  │   输出渲染    │             │
│  │   会话管理    │  │   /agents     │  │   结果展示    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────┐
│                          编排层                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Agent      │  │   任务       │  │   上下文      │             │
│  │   选择器     │  │   编排器     │  │   管理器      │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────┐
│                          能力桥接层                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Agent      │  │   框架       │  │   格式       │             │
│  │   解析器     │  │   适配器     │  │   转换器     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────┐
│                          执行层                                       │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │ pi-coding    │  │   Hermes     │                                │
│  │ agent        │  │   agent      │                                │
│  └──────────────┘  └──────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

**四层架构**：
1. **CLI交互层** - 用户交互界面
2. **编排层** - 核心业务逻辑
3. **能力桥接层** - Agent员工到执行框架的映射
4. **执行层** - 调用pi-coding-agent或Hermes

## 3. 核心组件

### 3.1 CLI交互层组件

**REPL会话管理器** (`cli/session.ts`)
- 维护用户会话状态和历史
- 处理用户输入和命令
- 管理会话退出和清理

**命令解析器** (`cli/parser.ts`)
- 解析用户命令（任务描述、控制命令）
- 识别特殊命令（`/agents`、`/clear`、`/exit`等）
- 提取任务实体和意图

**输出渲染器** (`cli/renderer.ts`)
- 格式化展示Agent员工信息
- 渲染任务执行结果
- 展示系统状态和进度

### 3.2 编排层组件

**Agent选择器** (`orchestrator/agent-selector.ts`)
- 分析用户任务需求
- 从本地缓存搜索匹配的Agent
- 支持用户显式指定和智能推荐

**任务编排器** (`orchestrator/task-orchestrator.ts`)
- 拆解复杂任务为子任务
- 调度Agent执行顺序
- 处理任务依赖和并发

**上下文管理器** (`orchestrator/context-manager.ts`)
- 维护会话历史上下文
- 管理Agent切换的场景延续
- 处理跨Agent的知识传递

### 3.3 能力桥接层组件

**Agent解析器** (`bridge/agent-parser.ts`)
- 解析AGENT.md frontmatter和内容
- 解析skills/SKILL.md文件
- 解析knowledges/*.md文件

**框架适配器** (`bridge/framework-adapter.ts`)
- 定义统一的Agent能力接口
- 实现pi-coding-agent适配器
- 实现Hermes适配器

**格式转换器** (`bridge/format-converter.ts`)
- Agent员工格式 → 执行框架配置格式
- skills → tools/skills映射
- knowledges → knowledge/context注入

## 4. 能力桥接机制

### 4.1 Agent员工结构到执行框架的映射

```typescript
// Agent员工格式（arm）
interface AgentEmployee {
  name: string;
  version: string;
  description: string;
  systemPrompt: string;
  skills: Skill[];
  knowledges: Knowledge[];
}

// 执行框架通用格式
interface FrameworkConfig {
  agent: {
    name: string;
    role: string;
    systemPrompt: string;
  };
  capabilities: {
    tools: ToolConfig[];
    knowledge: KnowledgeConfig[];
  };
}
```

### 4.2 能力映射规则

**Skills映射**：
```
Agent Skill              →  执行框架Tool
├── name                 →  tool.name
├── description          →  tool.description
├── allowed-tools        →  tool.permissions
└── compatibility        →  tool.requirements
```

**Knowledges映射**：
```
Agent Knowledge          →  执行框架Context
├── title                →  knowledge.source
├── content              →  knowledge.content
└── metadata             →  knowledge.tags
```

**Agent描述映射**：
```
AGENT.md frontmatter     →  框架Agent配置
├── name                 →  agent.name
├── description          →  agent.role
└── systemPrompt         →  agent.systemPrompt
```

### 4.3 框架适配器接口

```typescript
interface FrameworkAdapter {
  // 获取框架名称
  getName(): string;
  
  // 转换Agent配置为框架格式
  adaptAgent(agent: AgentEmployee): FrameworkConfig;
  
  // 调用框架执行任务
  execute(config: FrameworkConfig, task: string): Promise<ExecutionResult>;
  
  // 验证框架可用性
  isAvailable(): boolean;
}
```

## 5. 交互流程设计

### 5.1 启动流程

```
用户运行 bee
    │
    ├─→ 加载配置 (~/.bee/config.json)
    ├─→ 初始化Agent缓存 (~/.bee/agents/)
    ├─→ 检查执行框架可用性
    └─→ 启动REPL会话
        │
        ├─→ 展示欢迎信息
        ├─→ 列出可用Agent员工（简要）
        └─→ 等待用户输入
```

### 5.2 任务执行流程

```
用户输入任务
    │
    ├─→ [命令判断]
    │   ├─→ 特殊命令 (/agents, /clear, /exit) → 执行相应操作
    │   └─→ 任务描述 → 继续
    │
    ├─→ [Agent选择]
    │   ├─→ 用户指定Agent → 直接使用
    │   ├─→ 智能匹配 → 从缓存搜索匹配Agent
    │   └─→ 找不到 → 提示用户/建议下载
    │
    ├─→ [能力桥接]
    │   ├─→ 解析Agent配置文件
    │   ├─→ 加载skills和knowledges
    │   ├─→ 转换为执行框架格式
    │   └─→ 选择执行框架
    │
    ├─→ [任务执行]
    │   ├─→ 调用执行框架
    │   ├─→ 监控执行状态
    │   └─→ 处理执行结果
    │
    └─→ [结果反馈]
        ├─→ 渲染执行结果
        ├─→ 更新会话上下文
        └─→ 等待下一次输入
```

### 5.3 Agent管理流程

```
用户执行 /agents 命令
    │
    ├─→ 列出本地缓存Agent
    ├─→ [Agent操作]
    │   ├─→ download <name> → 调用arm下载
    │   ├─→ update <name> → 更新Agent到最新版本
    │   ├─→ remove <name> → 从本地移除
    │   └─→ info <name> → 显示Agent详情
    │
    └─→ 返回REPL
```

## 6. 数据流和存储设计

### 6.1 目录结构

```
~/.bee/
├── config.json              # bee配置文件
├── agents/                  # Agent员工缓存
│   ├── {agent-name}/
│   │   ├── AGENT.md
│   │   ├── skills/
│   │   │   └── {skill-name}/
│   │   │       └── SKILL.md
│   │   └── knowledges/
│   │       └── {knowledge-title}.md
├── sessions/                # 会话历史
│   └── {session-id}.json
├── cache/                   # RAG索引缓存
│   └── {agent-name}/
│       └── knowledge-index.json
└── logs/                    # 日志文件
    └── bee.log
```

### 6.2 配置文件格式

```json
{
  "version": "1.0.0",
  "framework": {
    "default": "pi-coding-agent",
    "pi-coding-agent": {
      "path": "/path/to/pi-coding-agent",
      "enabled": true
    },
    "hermes": {
      "path": "/path/to/hermes", 
      "enabled": true
    }
  },
  "agent": {
    "cachePath": "~/.bee/agents",
    "autoUpdate": false,
    "updateInterval": "24h"
  },
  "arm": {
    "serverUrl": "http://localhost:3000",
    "apiKey": ""
  },
  "rag": {
    "enabled": true,
    "chunkSize": 1000,
    "topK": 3
  },
  "session": {
    "maxHistory": 50,
    "persistence": true
  }
}
```

### 6.3 数据流

```
用户任务
    │
    ├─→ [输入处理]
    │   └─→ 任务解析 + 意图识别
    │
    ├─→ [Agent获取]
    │   ├─→ 本地缓存查找
    │   └─→ arm API调用（如需下载）
    │
    ├─→ [能力解析]
    │   ├─→ AGENT.md解析
    │   ├─→ skills/*解析
    │   └─→ knowledges/*解析 + RAG索引
    │
    ├─→ [格式转换]
    │   └─→ Agent格式 → 框架格式
    │
    ├─→ [执行调用]
    │   └─→ pi-coding-agent/Hermes调用
    │
    └─→ [结果处理]
        ├─→ 结果解析
        ├─→ 格式化输出
        └─→ 会话上下文更新
```

## 7. 技术实现方案

### 7.1 技术栈

**语言和运行时**：
- 语言：TypeScript
- 运行时：Bun（与arm CLI保持一致）
- 包管理：bun

**核心依赖**：
```json
{
  "dependencies": {
    "commander": "^11.0.0",        // CLI框架
    "inquirer": "^9.0.0",          // 交互式输入
    "chalk": "^5.0.0",             // 终端色彩
    "ora": "^7.0.0",               // 加载动画
    "table": "^6.8.0",             // 表格展示
    "yaml": "^2.3.0",              // YAML解析
    "axios": "^1.6.0",             // HTTP客户端（调用arm API）
    "vectordb": "^1.0.0"          // 向量数据库（RAG）
  }
}
```

### 7.2 模块结构

```
bee/
├── src/
│   ├── main.ts                 # 入口文件
│   ├── cli/                    # CLI交互层
│   │   ├── session.ts
│   │   ├── parser.ts
│   │   └── renderer.ts
│   ├── orchestrator/           # 编排层
│   │   ├── agent-selector.ts
│   │   ├── task-orchestrator.ts
│   │   └── context-manager.ts
│   ├── bridge/                 # 能力桥接层
│   │   ├── agent-parser.ts
│   │   ├── framework-adapter.ts
│   │   ├── format-converter.ts
│   │   ├── pi-coding-adapter.ts
│   │   └── hermes-adapter.ts
│   ├── storage/                # 存储层
│   │   ├── config.ts
│   │   ├── agent-cache.ts
│   │   └── session-store.ts
│   ├── rag/                    # RAG检索
│   │   ├── knowledge-indexer.ts
│   │   └── knowledge-retriever.ts
│   ├── arm/                    # arm集成
│   │   └── client.ts
│   └── lib/                    # 工具函数
│       ├── logger.ts
│       └── utils.ts
├── package.json
├── tsconfig.json
└── README.md
```

## 8. 错误处理和扩展性

### 8.1 错误处理策略

**错误分类**：
```typescript
enum ErrorType {
  // 配置错误
  CONFIG_MISSING = "CONFIG_MISSING",
  CONFIG_INVALID = "CONFIG_INVALID",
  
  // Agent相关错误
  AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
  AGENT_PARSE_FAILED = "AGENT_PARSE_FAILED",
  AGENT_DOWNLOAD_FAILED = "AGENT_DOWNLOAD_FAILED",
  
  // 执行框架错误
  FRAMEWORK_NOT_AVAILABLE = "FRAMEWORK_NOT_AVAILABLE",
  FRAMEWORK_EXECUTION_FAILED = "FRAMEWORK_EXECUTION_FAILED",
  
  // RAG相关错误
  KNOWLEDGE_INDEX_FAILED = "KNOWLEDGE_INDEX_FAILED",
  KNOWLEDGE_RETRIEVE_FAILED = "KNOWLEDGE_RETRIEVE_FAILED"
}
```

**错误处理流程**：
```
错误发生
    │
    ├─→ 记录日志（详细错误信息）
    ├─→ 生成用户友好消息
    ├─→ 提供修复建议（如有）
    └─→ 决定是否继续会话
```

### 8.2 扩展性设计

**新执行框架接入**：
```typescript
// 实现FrameworkAdapter接口
class NewFrameworkAdapter implements FrameworkAdapter {
  getName(): string { return "new-framework"; }
  adaptAgent(agent: AgentEmployee): FrameworkConfig { /* ... */ }
  execute(config: FrameworkConfig, task: string): Promise<ExecutionResult> { /* ... */ }
  isAvailable(): boolean { /* ... */ }
}

// 注册适配器
adapterRegistry.register(new NewFrameworkAdapter());
```

**新Agent能力支持**：
- Agent员工格式扩展（新的frontmatter字段）
- 能力映射规则更新
- 格式转换器扩展

### 8.3 测试策略

**单元测试**：
- Agent解析器测试
- 格式转换器测试
- RAG检索测试

**集成测试**：
- 完整任务执行流程测试
- 多框架切换测试
- Agent下载和缓存测试

**E2E测试**：
- 真实arm环境测试
- 真实执行框架调用测试

## 9. 设计总结

bee agent的设计核心思想是**桥接**：

1. **桥接arm管理与执行**：将arm中的Agent员工通过能力桥接层转换为可执行的配置
2. **桥接不同执行框架**：通过适配器模式统一pi-coding-agent和Hermes的差异
3. **桥接用户意图与Agent能力**：通过智能选择和匹配，让用户任务自动找到合适的Agent

**关键特性**：
- REPL交互模式，支持连续对话
- 混合Agent选择策略（指定+推荐）
- 动态能力加载和RAG知识检索
- 完整的错误处理和用户友好的提示
- 灵活的扩展性设计

**技术选型**：
- TypeScript + Bun保证类型安全和性能
- 模块化架构保证可维护性
- 适配器模式保证框架可扩展性
