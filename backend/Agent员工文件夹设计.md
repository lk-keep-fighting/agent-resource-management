# Agent员工文件夹设计规范

## 概述

用户通过下载API获取Agent员工包，下载的文件为一个ZIP压缩包。

## 目录结构

```
agent-content/
├── AGENT.md          # Agent主配置文件
├── skills/           # 技能目录
│   ├── skill-name-1/ # 每个技能一个目录（从skill.zip解压）
│   │   ├── SKILL.md
│   │   └── ...       # 技能其他文件
│   └── skill-name-2/
└── knowledges/       # 知识目录
    ├── title-1.md
    └── title-2.md
```

## AGENT.md 格式

Agent的主配置文件，采用 YAML Frontmatter 格式。

### Frontmatter 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | Agent名称 |
| version | string | 版本号 |
| description | string | Agent描述 |
| skills | array | 关联的技能列表 |
| knowledges | array | 关联的知识文件列表 |

### 示例

```yaml
---
name: 我的Agent
version: 1.0.0
description: 这是一个智能Agent
skills:
  - name: web-search
  - name: calculator
knowledges:
  - 产品手册.md
  - FAQ.md
---

# System Prompt
你是一个智能助手，可以帮助用户完成各种任务。
```

## Skills 目录格式

每个Skill对应 `skills/` 下的一个子目录，从原始Skill的ZIP包解压而来。

### 必须包含

- `SKILL.md` - Skill的主配置文件

### SKILL.md 格式

```yaml
---
name: 技能名称
description: 技能描述
license: MIT
compatibility: v1.0+
allowed-tools: tool1,tool2,tool3
tags: 标签1,标签2,标签3
---

# 技能详细说明（Markdown格式）
```

### Frontmatter 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 技能名称 |
| description | string | 技能描述 |
| license | string | 许可证 |
| compatibility | string | 兼容性版本 |
| allowed-tools | string | 允许使用的工具列表（逗号分隔） |
| tags | string | 标签列表（逗号分隔） |

## Knowledges 目录格式

每个知识文件为独立的 `.md` 文件。

### 文件命名

- 文件名基于知识的标题
- 使用 `sanitizeFilename()` 函数处理：替换非常规字符为下划线
- 保留 `.md` 扩展名

### 文件内容

直接保存知识的原始内容。如果知识内容获取失败，则写入：

```markdown
# {知识标题}

知识内容获取失败
```

## 下载API

### Agent下载接口

```
GET /api/v1/agents/{id}/download
```

返回：`application/zip` 类型的ZIP文件

### 响应头

| 字段 | 说明 |
|------|------|
| Content-Type | application/zip |
| Content-Disposition | attachment; filename="{agent名称}.zip" |
| X-Version | Agent版本号 |

## 上传规范

### Skill上传要求

1. 必须上传ZIP包
2. ZIP包内必须包含 `SKILL.md` 文件
3. SKILL.md 需包含有效的frontmatter

### 目录层级处理

上传系统会自动处理以下情况：
- SKILL.md 在ZIP根目录
- SKILL.md 在ZIP内某个子目录中
- SKILL.md 在ZIP内多层嵌套
