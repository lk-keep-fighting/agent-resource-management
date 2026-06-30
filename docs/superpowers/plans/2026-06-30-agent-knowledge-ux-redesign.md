# Agent / Knowledge 管理 UX 重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Agent / Knowledge 的创建与维护从「列表页内嵌 480px 面板 + 3 步向导 + 嵌套弹窗」重设计为「列表卡片墙 + 全屏两栏编辑页 + 已绑清单+选择器」，并顺手拆分 1114 行单文件。

**Architecture:** 纯前端改造（Next.js 14 App Router 客户端组件），复用现有 REST API，不改 append-only 绑定语义。新建共享 UI 原语、绑定组件、Agent/Knowledge 编辑器组件，再把页面瘦身为「取数 + 组装」。Skill 页不动。

**Tech Stack:** Next.js 14 (App Router)、React 18、TypeScript、shadcn/ui (Radix)、Tailwind CSS、lucide-react、react-markdown、@dicebear（头像）。

## Global Constraints

- **无 JS 测试框架**：`backend/package.json` 仅 `dev/build/start/lint`。每个任务的「验证」= `pnpm lint`（在 `backend/` 下运行）+ 手动冒烟（`pnpm dev`，端口 **3001**，需已登录会话，见 `AGENTS.md`）。**不要**虚构单测；组件任务的完整行为在其被接入页面任务的冒烟中验证。
- **API 响应格式固定**：HTTP `{ ok: boolean, data, msg }`。
- **绑定 append-only 不变**（`AGENTS.md` §6.3）：保存时沿用「删缺失 + 增量绑」逻辑，绝不 update/硬删已有 binding 行；版本语义对用户透明。
- **Skill 页（`/skills`）不动**；仅在选择器里复用 `/api/v1/skills`。
- **权限沿用现状**：Knowledge 编辑按钮可见性沿用现有 ADMIN 门控（见 Task 7 说明），不改后端鉴权。
- 命名/文案沿用现有中文风格（员工、能力、知识、必备/经验）。
- 每个任务结束 `git commit`，commit message 遵循仓库 `feat(web): ...` 风格。

---

## File Structure

**新建共享 UI 原语（`backend/src/components/ui/`）**
- `list-page-header.tsx` — 列表页统一顶栏（标题 + 搜索 + 新建 + 额外筛选 slot）
- `tag-input.tsx` — 真正的标签输入（回车/逗号添加、退格删、× 删）
- `markdown-editor.tsx` — 左编辑 / 右预览 的 Markdown 编辑器

**新建绑定组件（`backend/src/components/binding/`）**
- `kind-toggle.tsx` — essential/experience 切换按钮
- `bound-skill-list.tsx` — 已绑能力清单（含 `BoundSkill` 类型导出）
- `bound-knowledge-list.tsx` — 已绑知识清单，按 kind 分组（含 `BoundKnowledge`/`KnowledgeKind` 类型导出）
- `resource-picker-dialog.tsx` — 通用「搜索 + 多选 + 新建链接」选择器（含 `PickerItem` 类型导出）

**新建编辑器（`backend/src/components/agent/`、`backend/src/components/knowledge/`）**
- `agent/agent-editor.tsx` — Agent 两栏编辑器（create/edit 自取初始数据）
- `knowledge/knowledge-editor.tsx` — Knowledge 两栏编辑器（表单 + 预览 + 关联版本更新）

**页面（路由层，瘦）**
- 改写 `agents/page.tsx`；新建 `agents/new/page.tsx`、`agents/[id]/page.tsx`、`agents/[id]/edit/page.tsx`
- 改写 `knowledges/page.tsx`；新建 `knowledges/new/page.tsx`、`knowledges/[id]/page.tsx`、`knowledges/[id]/edit/page.tsx`

依赖顺序：Task 1（原语）→ Task 2（绑定原子）→ Task 3（选择器）→ Task 4（Agent 编辑器）→ Task 5（Agent 页面）→ Task 6（Knowledge 编辑器）→ Task 7（Knowledge 页面）→ Task 8（清理回归）。

---

### Task 1: 共享 UI 原语（ListPageHeader / TagInput / MarkdownEditor）

**Files:**
- Create: `backend/src/components/ui/list-page-header.tsx`
- Create: `backend/src/components/ui/tag-input.tsx`
- Create: `backend/src/components/ui/markdown-editor.tsx`

**Interfaces:**
- Produces: `ListPageHeader({ title, keyword, onKeywordChange, onCreate?, createLabel?, children? })`；`TagInput({ value: string[], onChange, placeholder? })`；`MarkdownEditor({ value: string, onChange, placeholder?, minHeight? })`

- [ ] **Step 1: 创建 `list-page-header.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

interface ListPageHeaderProps {
  title: string;
  keyword: string;
  onKeywordChange: (v: string) => void;
  onSearchSubmit?: () => void;
  onCreate?: () => void;
  createLabel?: string;
  children?: React.ReactNode;
}

export function ListPageHeader({
  title,
  keyword,
  onKeywordChange,
  onCreate,
  createLabel = "新建",
  children,
}: ListPageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索..."
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
        {children}
        {onCreate && (
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {createLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 `tag-input.tsx`**

```tsx
"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = "输入标签后回车添加",
}: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="flex flex-wrap gap-2 p-2 min-h-[42px] rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded-full"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:text-blue-800"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => input && addTag(input)}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
      />
    </div>
  );
}
```

- [ ] **Step 3: 创建 `markdown-editor.tsx`**

```tsx
"use client";

import ReactMarkdown from "react-markdown";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "支持 Markdown 格式...",
  minHeight = 320,
}: MarkdownEditorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">编辑</div>
        <textarea
          className="w-full border rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ minHeight }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">预览</div>
        <div
          className="border rounded-md p-3 text-sm prose prose-sm max-w-none overflow-auto bg-gray-50"
          style={{ minHeight }}
        >
          {value ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <span className="text-gray-400">预览区</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: lint 验证**

Run: `cd backend && pnpm lint`
Expected: 无 error（新建文件无引用，仅语法/类型检查通过）

- [ ] **Step 5: Commit**

```bash
git add backend/src/components/ui/list-page-header.tsx backend/src/components/ui/tag-input.tsx backend/src/components/ui/markdown-editor.tsx
git commit -m "feat(web): 新增 ListPageHeader / TagInput / MarkdownEditor 共享原语"
```

---

### Task 2: 绑定原子组件（KindToggle / BoundSkillList / BoundKnowledgeList）

**Files:**
- Create: `backend/src/components/binding/kind-toggle.tsx`
- Create: `backend/src/components/binding/bound-skill-list.tsx`
- Create: `backend/src/components/binding/bound-knowledge-list.tsx`

**Interfaces:**
- Produces: `KnowledgeKind = "essential" | "experience"`；`KindToggle({ kind, onChange })`；`BoundSkill { skillId; skill: { id; name; description } }` + `BoundSkillList({ items, onRemove })`；`BoundKnowledge { knowledgeId; name; description?; kind }` + `BoundKnowledgeList({ items, onRemove, onChangeKind })`
- Consumes（本任务内部）: `KindToggle` 被 `BoundKnowledgeList` 使用

- [ ] **Step 1: 创建 `kind-toggle.tsx`**

```tsx
"use client";

export type KnowledgeKind = "essential" | "experience";

interface KindToggleProps {
  kind: KnowledgeKind;
  onChange: (kind: KnowledgeKind) => void;
}

export function KindToggle({ kind, onChange }: KindToggleProps) {
  const isEssential = kind === "essential";
  return (
    <button
      type="button"
      onClick={() => onChange(isEssential ? "experience" : "essential")}
      className={`text-xs px-2 py-1 rounded border transition-colors ${
        isEssential
          ? "border-amber-300 text-amber-700 hover:bg-amber-100"
          : "border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
      title={isEssential ? "点击改为工作经验" : "点击改为必备业务知识"}
    >
      {isEssential ? "必备" : "经验"}
    </button>
  );
}
```

- [ ] **Step 2: 创建 `bound-skill-list.tsx`**

```tsx
"use client";

import { Sparkles, X } from "lucide-react";

export interface BoundSkill {
  skillId: string;
  skill: { id: string; name: string; description: string };
}

interface BoundSkillListProps {
  items: BoundSkill[];
  onRemove: (skillId: string) => void;
}

export function BoundSkillList({ items, onRemove }: BoundSkillListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">暂未绑定能力</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((s) => (
        <div
          key={s.skillId}
          className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{s.skill.name}</div>
              <div className="text-xs text-gray-500 truncate">
                {s.skill.description}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemove(s.skillId)}
            className="text-gray-400 hover:text-red-500 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 创建 `bound-knowledge-list.tsx`**

```tsx
"use client";

import { BookOpen, X } from "lucide-react";
import { KindToggle, type KnowledgeKind } from "./kind-toggle";

export type { KnowledgeKind } from "./kind-toggle";

export interface BoundKnowledge {
  knowledgeId: string;
  name: string;
  description?: string;
  kind: KnowledgeKind;
}

interface BoundKnowledgeListProps {
  items: BoundKnowledge[];
  onRemove: (knowledgeId: string) => void;
  onChangeKind: (knowledgeId: string, kind: KnowledgeKind) => void;
}

export function BoundKnowledgeList({
  items,
  onRemove,
  onChangeKind,
}: BoundKnowledgeListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">暂未绑定知识</p>;
  }
  const essentialCount = items.filter((i) => i.kind === "essential").length;
  const groups: {
    kind: KnowledgeKind;
    label: string;
    hint?: string;
  }[] = [
    {
      kind: "essential",
      label: "必备业务知识（下载到环境）",
      hint:
        essentialCount > 5 ? "必备过多（>5）会拖慢启动" : undefined,
    },
    { kind: "experience", label: "工作经验（按需检索）" },
  ];
  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const groupItems = items.filter((i) => i.kind === g.kind);
        if (groupItems.length === 0) return null;
        const isEssential = g.kind === "essential";
        return (
          <div key={g.kind} className="space-y-2">
            <div
              className={`text-xs font-medium ${
                isEssential ? "text-amber-600" : "text-gray-500"
              }`}
            >
              {g.label}
              {g.hint && <span className="ml-2 text-amber-500">{g.hint}</span>}
            </div>
            {groupItems.map((k) => (
              <div
                key={k.knowledgeId}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  isEssential
                    ? "bg-amber-50 border-amber-200"
                    : "bg-green-50 border-green-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen
                    className={`h-4 w-4 shrink-0 ${
                      isEssential ? "text-amber-500" : "text-green-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{k.name}</div>
                    {k.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {k.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <KindToggle
                    kind={k.kind}
                    onChange={(kind) => onChangeKind(k.knowledgeId, kind)}
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(k.knowledgeId)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: lint 验证**

Run: `cd backend && pnpm lint`
Expected: 无 error

- [ ] **Step 5: Commit**

```bash
git add backend/src/components/binding/kind-toggle.tsx backend/src/components/binding/bound-skill-list.tsx backend/src/components/binding/bound-knowledge-list.tsx
git commit -m "feat(web): 新增 KindToggle / BoundSkillList / BoundKnowledgeList 绑定组件"
```

---

### Task 3: 通用资源选择器 ResourcePickerDialog

**Files:**
- Create: `backend/src/components/binding/resource-picker-dialog.tsx`

**Interfaces:**
- Produces: `PickerItem { id; name; description? }`；`ResourcePickerDialog({ open, onOpenChange, title, items, searchResults?, onSearch?, excludedIds?, onConfirm, createHref?, createLabel? })`
  - `items`：基础列表（客户端过滤）。`searchResults`：服务端搜索结果覆盖（传 `null`/`undefined` 时回落到 `items` 客户端过滤）。`excludedIds`：已绑 id（从列表隐藏）。`onConfirm(ids)`：确认时回调选中的 id 数组，并自动关闭。

- [ ] **Step 1: 创建 `resource-picker-dialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PickerItem {
  id: string;
  name: string;
  description?: string;
}

interface ResourcePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: PickerItem[];
  searchResults?: PickerItem[] | null;
  onSearch?: (keyword: string) => void;
  excludedIds?: string[];
  onConfirm: (ids: string[]) => void;
  createHref?: string;
  createLabel?: string;
}

export function ResourcePickerDialog({
  open,
  onOpenChange,
  title,
  items,
  searchResults,
  onSearch,
  excludedIds = [],
  onConfirm,
  createHref,
  createLabel,
}: ResourcePickerDialogProps) {
  const [keyword, setKeyword] = useState("");
  const [checked, setChecked] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setKeyword("");
      setChecked([]);
    }
  }, [open]);

  const handleSearchChange = (v: string) => {
    setKeyword(v);
    onSearch?.(v);
  };

  const base = (searchResults ?? items).filter(
    (i) => !excludedIds.includes(i.id)
  );
  const filtered = searchResults
    ? base
    : base.filter(
        (i) =>
          !keyword.trim() ||
          i.name.toLowerCase().includes(keyword.toLowerCase()) ||
          (i.description?.toLowerCase().includes(keyword.toLowerCase()) ??
            false)
      );

  const toggle = (id: string) => {
    setChecked((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : [...c, id]
    );
  };

  const handleConfirm = () => {
    onConfirm(checked);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索..."
            value={keyword}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex-1 overflow-auto space-y-2 min-h-[200px]">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">无匹配项</p>
          ) : (
            filtered.map((item) => {
              const isChecked = checked.includes(item.id);
              return (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(item.id)}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>
        {createHref && (
          <a
            href={createHref}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            {createLabel ?? "没有？新建 →"}
          </a>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={checked.length === 0}>
            添加{checked.length > 0 ? ` ${checked.length} 项` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: lint 验证**

Run: `cd backend && pnpm lint`
Expected: 无 error

- [ ] **Step 3: Commit**

```bash
git add backend/src/components/binding/resource-picker-dialog.tsx
git commit -m "feat(web): 新增通用 ResourcePickerDialog 选择器"
```

---

### Task 4: Agent 编辑器组件 AgentEditor

**Files:**
- Create: `backend/src/components/agent/agent-editor.tsx`

**Interfaces:**
- Consumes: `BoundSkill`/`BoundSkillList`、`BoundKnowledge`/`BoundKnowledgeList`/`KnowledgeKind`、`ResourcePickerDialog`/`PickerItem`、`AvatarPicker`、`Button`、`Input`
- Produces: `AgentEditor({ mode: "create" | "edit"; agentId?: string })`。edit 模式下组件自取 `/api/v1/agents/:id` 填充；保存成功后 `router.push('/agents/:id')`。

- [ ] **Step 1: 创建 `agent-editor.tsx`（两栏布局 + 保存/绑定同步逻辑）**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Sparkles, BookOpen, Plus, Save, X, Lightbulb } from "lucide-react";
import {
  BoundSkillList,
  type BoundSkill,
} from "@/components/binding/bound-skill-list";
import {
  BoundKnowledgeList,
  type BoundKnowledge,
  type KnowledgeKind,
} from "@/components/binding/bound-knowledge-list";
import {
  ResourcePickerDialog,
  type PickerItem,
} from "@/components/binding/resource-picker-dialog";

interface AgentFormData {
  name: string;
  description: string;
  prompt: string;
  avatar: string;
  status: "active" | "draft";
  version: string;
}

interface AgentEditorProps {
  mode: "create" | "edit";
  agentId?: string;
}

const EMPTY_FORM: AgentFormData = {
  name: "",
  description: "",
  prompt: "",
  avatar: "",
  status: "active",
  version: "1.0.0",
};

export function AgentEditor({ mode, agentId }: AgentEditorProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<AgentFormData>(EMPTY_FORM);
  const [boundSkills, setBoundSkills] = useState<BoundSkill[]>([]);
  const [boundKnowledges, setBoundKnowledges] = useState<BoundKnowledge[]>([]);
  const [skillCatalog, setSkillCatalog] = useState<PickerItem[]>([]);
  const [knowledgeCatalog, setKnowledgeCatalog] = useState<PickerItem[]>([]);
  const [knowledgeSearchResults, setKnowledgeSearchResults] = useState<
    PickerItem[] | null
  >(null);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showKnowledgePicker, setShowKnowledgePicker] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/skills?pageSize=100")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok)
          setSkillCatalog(
            (d.data.skills || []).map((s: any) => ({
              id: s.id,
              name: s.name,
              description: s.description,
            }))
          );
      });
    fetch("/api/v1/knowledges?pageSize=100")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok)
          setKnowledgeCatalog(
            (d.data.knowledges || []).map((k: any) => ({
              id: k.id,
              name: k.name,
              description: k.description,
            }))
          );
      });
  }, []);

  useEffect(() => {
    if (mode === "edit" && agentId) {
      fetch(`/api/v1/agents/${agentId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.data) {
            const a = d.data;
            setFormData({
              name: a.name,
              description: a.description,
              prompt: a.prompt,
              avatar: a.avatar || "",
              status: a.status,
              version: a.version,
            });
            setBoundSkills(
              (a.skills || []).map((s: any) => ({
                skillId: s.skillId,
                skill: {
                  id: s.skill.id,
                  name: s.skill.name,
                  description: s.skill.description,
                },
              }))
            );
            setBoundKnowledges(
              (a.knowledges || []).map((k: any) => ({
                knowledgeId: k.knowledgeId,
                name: k.name || k.knowledgeId,
                description: k.description,
                kind: (k.kind ?? "experience") as KnowledgeKind,
              }))
            );
          }
        })
        .finally(() => setLoading(false));
    }
  }, [mode, agentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        加载中...
      </div>
    );
  }

  const handleKnowledgeSearch = (keyword: string) => {
    if (!keyword.trim()) {
      setKnowledgeSearchResults(null);
      return;
    }
    fetch(
      `/api/v1/knowledges?search=${encodeURIComponent(keyword)}&pageSize=50`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.ok)
          setKnowledgeSearchResults(
            (d.data.knowledges || []).map((k: any) => ({
              id: k.id,
              name: k.name,
              description: k.description,
            }))
          );
      });
  };

  const addSkills = (ids: string[]) => {
    const additions: BoundSkill[] = ids
      .map((id) => skillCatalog.find((x) => x.id === id))
      .filter((x): x is PickerItem => !!x)
      .map((x) => ({
        skillId: x.id,
        skill: { id: x.id, name: x.name, description: x.description || "" },
      }));
    setBoundSkills((prev) => [...prev, ...additions]);
  };

  const addKnowledges = (ids: string[]) => {
    const pool = knowledgeSearchResults ?? knowledgeCatalog;
    const additions: BoundKnowledge[] = ids
      .map((id) => pool.find((x) => x.id === id))
      .filter((x): x is PickerItem => !!x)
      .map((x) => ({
        knowledgeId: x.id,
        name: x.name,
        description: x.description,
        kind: "experience" as KnowledgeKind,
      }));
    setBoundKnowledges((prev) => [...prev, ...additions]);
  };

  const bindAll = async (id: string) => {
    for (const s of boundSkills) {
      await fetch(`/api/v1/agents/${id}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: s.skillId }),
      });
    }
    for (const k of boundKnowledges) {
      await fetch(`/api/v1/agents/${id}/knowledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgeId: k.knowledgeId,
          kind: k.kind,
          retrievalConfig: { topK: 5 },
        }),
      });
    }
  };

  const syncBindings = async (id: string) => {
    const curK = await fetch(`/api/v1/agents/${id}/knowledges`).then((r) =>
      r.json()
    );
    const curKIds: string[] = (curK.data || []).map((x: any) => x.knowledgeId);
    for (const removeId of curKIds.filter(
      (kid) => !boundKnowledges.some((k) => k.knowledgeId === kid)
    )) {
      await fetch(
        `/api/v1/agents/${id}/knowledges?knowledgeId=${removeId}`,
        { method: "DELETE" }
      );
    }
    const curS = await fetch(`/api/v1/agents/${id}/skills`).then((r) =>
      r.json()
    );
    const curSIds: string[] = (curS.data || []).map((x: any) => x.skillId);
    for (const removeId of curSIds.filter(
      (sid) => !boundSkills.some((s) => s.skillId === sid)
    )) {
      await fetch(`/api/v1/agents/${id}/skills?skillId=${removeId}`, {
        method: "DELETE",
      });
    }
    await bindAll(id);
  };

  const handleSave = async () => {
    setError("");
    if (!formData.name.trim()) return setError("请输入员工姓名");
    if (!formData.prompt.trim()) return setError("请输入角色定义");
    setSaving(true);
    try {
      let id = agentId;
      if (mode === "create") {
        const res = await fetch("/api/v1/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.msg || "创建失败");
          setSaving(false);
          return;
        }
        id = data.data.id;
        await bindAll(id!);
      } else if (id) {
        const res = await fetch(`/api/v1/agents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.msg || "保存失败");
          setSaving(false);
          return;
        }
        await syncBindings(id);
      }
      router.push(`/agents/${id}`);
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">
          {mode === "create" ? "新建员工" : `编辑：${formData.name}`}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <X className="h-4 w-4 mr-1" />
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

      <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
        {/* 左栏：基本信息 */}
        <div className="overflow-auto pr-2 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">员工姓名 *</label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="例如：智能客服助手"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">员工头像</label>
            <AvatarPicker
              value={formData.avatar}
              onChange={(avatar) => setFormData({ ...formData, avatar })}
              seed={
                formData.avatar
                  ? JSON.parse(formData.avatar)?.seed
                  : undefined
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">员工描述</label>
            <textarea
              className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="描述这位员工的工作职责和能力特点..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">角色定义 Prompt *</label>
            <textarea
              className="w-full min-h-[120px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.prompt}
              onChange={(e) =>
                setFormData({ ...formData, prompt: e.target.value })
              }
              placeholder="定义这位员工的行为准则、回答风格等..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">版本号</label>
              <Input
                value={formData.version}
                onChange={(e) =>
                  setFormData({ ...formData, version: e.target.value })
                }
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">状态</label>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.status === "active"}
                    onChange={() =>
                      setFormData({ ...formData, status: "active" })
                    }
                  />
                  <span className="text-sm">启用</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.status === "draft"}
                    onChange={() =>
                      setFormData({ ...formData, status: "draft" })
                    }
                  />
                  <span className="text-sm">停用</span>
                </label>
              </div>
            </div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700">
              好的描述可以帮助你更好地管理和识别这位员工
            </p>
          </div>
        </div>

        {/* 右栏：绑定 */}
        <div className="overflow-auto pr-2 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                能力 ({boundSkills.length})
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSkillPicker(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>
            <BoundSkillList
              items={boundSkills}
              onRemove={(sid) =>
                setBoundSkills((prev) =>
                  prev.filter((s) => s.skillId !== sid)
                )
              }
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                知识 ({boundKnowledges.length})
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowKnowledgePicker(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>
            <BoundKnowledgeList
              items={boundKnowledges}
              onRemove={(kid) =>
                setBoundKnowledges((prev) =>
                  prev.filter((k) => k.knowledgeId !== kid)
                )
              }
              onChangeKind={(kid, kind) =>
                setBoundKnowledges((prev) =>
                  prev.map((k) =>
                    k.knowledgeId === kid ? { ...k, kind } : k
                  )
                )
              }
            />
          </section>
        </div>
      </div>

      <ResourcePickerDialog
        open={showSkillPicker}
        onOpenChange={setShowSkillPicker}
        title="选择能力"
        items={skillCatalog}
        excludedIds={boundSkills.map((s) => s.skillId)}
        onConfirm={addSkills}
        createHref="/skills"
        createLabel="没有？上传新能力 →"
      />
      <ResourcePickerDialog
        open={showKnowledgePicker}
        onOpenChange={setShowKnowledgePicker}
        title="选择知识"
        items={knowledgeCatalog}
        searchResults={knowledgeSearchResults}
        onSearch={handleKnowledgeSearch}
        excludedIds={boundKnowledges.map((k) => k.knowledgeId)}
        onConfirm={addKnowledges}
        createHref="/knowledges/new"
        createLabel="没有？新建知识 →"
      />
    </div>
  );
}
```

- [ ] **Step 2: lint 验证**

Run: `cd backend && pnpm lint`
Expected: 无 error（完整行为在 Task 5 接入页面时冒烟）

- [ ] **Step 3: Commit**

```bash
git add backend/src/components/agent/agent-editor.tsx
git commit -m "feat(web): 新增 AgentEditor 两栏编辑器组件"
```

---

### Task 5: Agent 路由页面（列表改写 + new/detail/edit）

**Files:**
- Modify: `backend/src/app/(dashboard)/agents/page.tsx`（整体改写为卡片墙列表）
- Create: `backend/src/app/(dashboard)/agents/new/page.tsx`
- Create: `backend/src/app/(dashboard)/agents/[id]/page.tsx`（详情只读）
- Create: `backend/src/app/(dashboard)/agents/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `ListPageHeader`、`AgentEditor`、`getAvatarFromConfig`、`Card/CardContent`、`Button`
- 注：旧 `agents/page.tsx` 中的 3 步向导、内嵌创建 skill/knowledge 弹窗、内联 view/edit 面板全部移除（被新页面取代）。

- [ ] **Step 1: 改写 `agents/page.tsx`（卡片墙列表）**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { getAvatarFromConfig } from "@/components/ui/avatar-picker";
import { Bot, Wrench, BookOpen } from "lucide-react";

interface AgentListItem {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  version: string;
  status: "active" | "draft";
  skillsCount?: number;
  knowledgesCount?: number;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  const fetchAgents = useCallback((q: string) => {
    setLoading(true);
    const url = q
      ? `/api/v1/agents?keyword=${encodeURIComponent(q)}`
      : "/api/v1/agents";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAgents(d.data.agents);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchAgents(keyword), 300);
    return () => clearTimeout(t);
  }, [keyword, fetchAgents]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <ListPageHeader
        title="Agent 员工"
        keyword={keyword}
        onKeywordChange={setKeyword}
        onCreate={() => router.push("/agents/new")}
        createLabel="新建员工"
      />
      <div className="flex-1 overflow-auto">
        {loading && agents.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            加载中...
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Bot className="w-16 h-16 mb-4 text-gray-300" />
            <p className="mb-2">还没有添加任何员工</p>
            <p className="text-sm">点击右上角「新建员工」创建你的第一位 AI 员工</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => router.push(`/agents/${agent.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 mb-3 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                      {agent.avatar ? (
                        <img
                          src={getAvatarFromConfig(agent.avatar)}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Bot className="w-8 h-8 text-blue-500" />
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1 truncate w-full">
                      {agent.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2 h-8">
                      {agent.description || "暂无描述"}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                          agent.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {agent.status === "active" ? "启用" : "停用"}
                      </span>
                      <span className="text-xs text-gray-400">
                        v{agent.version}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Wrench className="h-3 w-3 text-blue-500" />
                        {agent.skillsCount || 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="h-3 w-3 text-green-500" />
                        {agent.knowledgesCount || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 `agents/new/page.tsx`**

```tsx
"use client";

import { AgentEditor } from "@/components/agent/agent-editor";

export default function NewAgentPage() {
  return <AgentEditor mode="create" />;
}
```

- [ ] **Step 3: 创建 `agents/[id]/page.tsx`（详情只读 + 编辑/下载/删除）**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getAvatarFromConfig } from "@/components/ui/avatar-picker";
import {
  Bot,
  Wrench,
  BookOpen,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AgentSkill {
  skillId: string;
  skill: { name: string };
}
interface AgentKnowledge {
  knowledgeId: string;
  name: string;
  kind?: "essential" | "experience";
}
interface AgentDetail {
  id: string;
  name: string;
  description: string;
  prompt: string;
  avatar?: string;
  version: string;
  status: "active" | "draft";
  skills?: AgentSkill[];
  knowledges?: AgentKnowledge[];
}

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [agent, setAgent] = useState<AgentDetail | null>(null);

  useEffect(() => {
    if (id)
      fetch(`/api/v1/agents/${id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setAgent(d.data);
        });
  }, [id]);

  if (!agent)
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        加载中...
      </div>
    );

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/v1/agents/${agent.id}/download`);
      if (!res.ok) return alert("下载失败");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${agent.name}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert("下载失败");
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除这个员工吗？")) return;
    try {
      const res = await fetch(`/api/v1/agents/${agent.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) router.push("/agents");
    } catch {
      console.error("Failed to delete agent");
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
            {agent.avatar ? (
              <img
                src={getAvatarFromConfig(agent.avatar)}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <Bot className="w-8 h-8 text-blue-500" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                  agent.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {agent.status === "active" ? "启用" : "停用"}
              </span>
              <span className="text-xs text-gray-500">v{agent.version}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" />
            下载
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/agents/${agent.id}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            编辑
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            删除
          </Button>
        </div>
      </div>

      <p className="text-gray-600 mb-6">
        {agent.description || "暂无描述"}
      </p>

      <div className="mb-6">
        <label className="text-sm font-medium flex items-center gap-1 mb-2">
          <Wrench className="h-4 w-4" /> 能力 ({agent.skills?.length || 0})
        </label>
        <div className="flex flex-wrap gap-2">
          {(agent.skills || []).length === 0 ? (
            <span className="text-sm text-gray-400">暂无</span>
          ) : (
            (agent.skills || []).map((s) => (
              <span
                key={s.skillId}
                className="px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded-full"
              >
                {s.skill.name}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium flex items-center gap-1 mb-2">
          <BookOpen className="h-4 w-4" /> 知识 ({agent.knowledges?.length || 0})
        </label>
        <div className="flex flex-wrap gap-2">
          {(agent.knowledges || []).length === 0 ? (
            <span className="text-sm text-gray-400">暂无</span>
          ) : (
            (agent.knowledges || []).map((k) => {
              const essential = (k.kind ?? "experience") === "essential";
              return (
                <span
                  key={k.knowledgeId}
                  className={`px-3 py-1 text-sm rounded-full ${
                    essential
                      ? "bg-amber-50 text-amber-700"
                      : "bg-green-50 text-green-600"
                  }`}
                >
                  {essential ? "必备·" : "经验·"}
                  {k.name}
                </span>
              );
            })
          )}
        </div>
      </div>

      {agent.prompt && (
        <div>
          <label className="text-sm font-medium block mb-2">角色定义 Prompt</label>
          <div className="text-sm prose prose-sm max-w-none border rounded-md p-4 bg-gray-50">
            <ReactMarkdown>{agent.prompt}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 创建 `agents/[id]/edit/page.tsx`**

```tsx
"use client";

import { useParams } from "next/navigation";
import { AgentEditor } from "@/components/agent/agent-editor";

export default function EditAgentPage() {
  const params = useParams();
  const id = params.id as string;
  return <AgentEditor mode="edit" agentId={id} />;
}
```

- [ ] **Step 5: 冒烟验证**

Run: `cd backend && pnpm dev`（端口 3001，需登录会话）
浏览器手动验证清单：
1. `/agents` → 卡片墙正常渲染，搜索防抖生效，「新建员工」跳转 `/agents/new`
2. `/agents/new` → 左右两栏；填姓名+Prompt；点「添加」选能力 → 已绑清单出现；点「添加」选知识 → 清单出现，点「经验/必备」切换 kind；保存 → 跳转 `/agents/[id]` 详情
3. 详情页：头像/状态/版本、能力 chips、知识 chips（必备/经验着色）、Prompt 渲染正确；编辑/下载/删除可用
4. `/agents/[id]/edit` → 预填正确（含已绑能力/知识 + kind）；移除一个能力、新增一个知识、改 kind、保存 → 详情反映变更
5. 回归 append-only：保存后能力/知识绑定正确增减，不报错

- [ ] **Step 6: lint 验证**

Run: `cd backend && pnpm lint`
Expected: 无 error

- [ ] **Step 7: Commit**

```bash
git add backend/src/app/\(dashboard\)/agents/
git commit -m "feat(web): Agent 拆为列表卡片墙 + new/detail/edit 全屏页"
```

---

### Task 6: Knowledge 编辑器组件 KnowledgeEditor

**Files:**
- Create: `backend/src/components/knowledge/knowledge-editor.tsx`

**Interfaces:**
- Consumes: `TagInput`、`MarkdownEditor`、`Button`、`Input`、`Dialog*`；接口 `/api/v1/knowledges`、`/api/v1/knowledges/:id`、`/api/v1/knowledges/:id/agents`、`/api/v1/agents/batch-version`
- Produces: `KnowledgeEditor({ mode: "create" | "edit"; knowledgeId?: string })`。保存成功后：create → 跳详情；edit → 若有关联 Agent 则弹「更新关联 Agent 版本」确认，否则跳详情。

- [ ] **Step 1: 创建 `knowledge-editor.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, X } from "lucide-react";

interface KnowledgeForm {
  name: string;
  description: string;
  content: string;
  tags: string[];
}

interface LinkedAgent {
  agentId: string;
  agentName: string;
  agentVersion: string;
}

interface KnowledgeEditorProps {
  mode: "create" | "edit";
  knowledgeId?: string;
}

const EMPTY_FORM: KnowledgeForm = {
  name: "",
  description: "",
  content: "",
  tags: [],
};

export function KnowledgeEditor({ mode, knowledgeId }: KnowledgeEditorProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<KnowledgeForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [linkedAgents, setLinkedAgents] = useState<LinkedAgent[]>([]);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [versionUpdating, setVersionUpdating] = useState(false);

  useEffect(() => {
    if (mode === "edit" && knowledgeId) {
      fetch(`/api/v1/knowledges/${knowledgeId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.data) {
            const k = d.data;
            setFormData({
              name: k.name || "",
              description: k.description || "",
              content: k.content || "",
              tags: k.tags || [],
            });
          }
        })
        .finally(() => setLoading(false));
    }
  }, [mode, knowledgeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        加载中...
      </div>
    );
  }

  const handleSave = async () => {
    setError("");
    if (!formData.name.trim()) return setError("请输入知识名称");
    if (!formData.content.trim()) return setError("请输入知识内容");
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        content: formData.content,
        tags: formData.tags,
      };
      let savedId = knowledgeId;
      if (mode === "create") {
        const res = await fetch("/api/v1/knowledges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.msg || "创建失败");
          setSaving(false);
          return;
        }
        savedId = data.data.id;
      } else if (savedId) {
        const res = await fetch(`/api/v1/knowledges/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.msg || "保存失败");
          setSaving(false);
          return;
        }
      }
      // edit 模式：检查关联 Agent，决定是否弹版本更新
      if (mode === "edit" && savedId) {
        const linked = await fetch(
          `/api/v1/knowledges/${savedId}/agents`
        ).then((r) => r.json());
        if (linked.ok && Array.isArray(linked.data) && linked.data.length > 0) {
          setLinkedAgents(linked.data);
          setSelectedAgentIds(linked.data.map((a: LinkedAgent) => a.agentId));
          setVersionModalOpen(true);
          setSaving(false);
          return;
        }
      }
      router.push(`/knowledges/${savedId}`);
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleVersionUpdate = async () => {
    if (!knowledgeId) return;
    if (selectedAgentIds.length === 0) {
      setVersionModalOpen(false);
      router.push(`/knowledges/${knowledgeId}`);
      return;
    }
    setVersionUpdating(true);
    try {
      const res = await fetch("/api/v1/agents/batch-version", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentIds: selectedAgentIds,
          knowledgeId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert(`已更新 ${data.data.updatedAgents.length} 个 Agent 版本`);
      } else {
        alert(data.message || "版本更新失败");
      }
    } catch {
      alert("版本更新失败");
    } finally {
      setVersionUpdating(false);
      setVersionModalOpen(false);
      router.push(`/knowledges/${knowledgeId}`);
    }
  };

  const toggleAgent = (id: string) =>
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">
          {mode === "create" ? "新建知识" : `编辑：${formData.name}`}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <X className="h-4 w-4 mr-1" />
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

      <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
        <div className="overflow-auto pr-2 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">知识名称 *</label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="例如：公司产品介绍"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">知识描述</label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="描述这个知识的用途"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">标签</label>
            <TagInput
              value={formData.tags}
              onChange={(tags) => setFormData({ ...formData, tags })}
              placeholder="输入标签后回车添加"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">知识内容 *</label>
            <textarea
              className="w-full min-h-[280px] px-3 py-2 text-sm font-mono border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="请输入知识的具体内容，支持 Markdown..."
            />
          </div>
        </div>

        <div className="overflow-auto pr-2">
          <div className="text-xs font-medium text-gray-500 mb-1">预览</div>
          <div className="border rounded-md p-4 text-sm prose prose-sm max-w-none bg-gray-50 min-h-[400px]">
            {formData.content ? (
              <MarkdownPreviewOnly content={formData.content} />
            ) : (
              <span className="text-gray-400">预览区</span>
            )}
          </div>
        </div>
      </div>

      <Dialog open={versionModalOpen} onOpenChange={setVersionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>更新关联 Agent 版本</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500 mb-4">
              此知识已关联以下 Agent，编辑后是否更新它们的版本号？
            </p>
            <div className="space-y-2 max-h-60 overflow-auto">
              {linkedAgents.map((agent) => (
                <label
                  key={agent.agentId}
                  className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedAgentIds.includes(agent.agentId)}
                    onChange={() => toggleAgent(agent.agentId)}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{agent.agentName}</div>
                    <div className="text-xs text-gray-500">
                      当前版本: {agent.agentVersion}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVersionModalOpen(false);
                router.push(`/knowledges/${knowledgeId}`);
              }}
              disabled={versionUpdating}
            >
              跳过
            </Button>
            <Button onClick={handleVersionUpdate} disabled={versionUpdating}>
              {versionUpdating ? "更新中..." : "确认更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 复用 ReactMarkdown 做只读预览（MarkdownEditor 是两栏编辑器，这里右侧只要预览）
import ReactMarkdown from "react-markdown";
function MarkdownPreviewOnly({ content }: { content: string }) {
  return <ReactMarkdown>{content}</ReactMarkdown>;
}
```

> 说明：Knowledge 编辑器左栏放表单字段（含 textarea 内容编辑），右栏放只读实时预览。`MarkdownEditor` 两栏组件供后续若需「编辑+预览并排」的场景复用；此处右侧用轻量 `MarkdownPreviewOnly` 以避免与左栏 textarea 重复出现两套编辑框。import 置于文件底部仅为可读性，实际可上移到文件顶部（lint 不报错即可）。

- [ ] **Step 2: lint 验证**

Run: `cd backend && pnpm lint`
Expected: 无 error（若 `import` 位置被 lint 警告，将其移到文件顶部 import 区）

- [ ] **Step 3: Commit**

```bash
git add backend/src/components/knowledge/knowledge-editor.tsx
git commit -m "feat(web): 新增 KnowledgeEditor 两栏编辑器（含关联版本更新）"
```

---

### Task 7: Knowledge 路由页面（列表卡片墙 + new/detail/edit）

**Files:**
- Modify: `backend/src/app/(dashboard)/knowledges/page.tsx`（表格 → 卡片墙）
- Create: `backend/src/app/(dashboard)/knowledges/new/page.tsx`
- Create: `backend/src/app/(dashboard)/knowledges/[id]/page.tsx`
- Create: `backend/src/app/(dashboard)/knowledges/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `ListPageHeader`、`KnowledgeEditor`、`TagFilter`/`SelectedTagsDisplay`、`Card/CardContent`、`Button`、`ReactMarkdown`
- **权限说明**：编辑/新建按钮沿用现有 ADMIN 门控（`user.role === "ADMIN"` 才显示编辑入口），与当前 `/knowledges` 一致；不改后端鉴权。冒烟时确认 PATCH 在 ADMIN 会话下可用。

- [ ] **Step 1: 改写 `knowledges/page.tsx`（卡片墙 + 标签筛选）**

```tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ListPageHeader } from "@/components/ui/list-page-header";
import {
  TagFilter,
  SelectedTagsDisplay,
} from "@/components/ui/tag-filter";
import { BookOpen } from "lucide-react";

interface Knowledge {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  updatedAt?: string;
  creatorName?: string;
}
interface Tag {
  id: string;
  name: string;
  knowledgeCount?: number;
}

export default function KnowledgesPage() {
  const router = useRouter();
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"and" | "or">("or");
  const [user, setUser] = useState<{ role?: string } | null>(null);

  const fetchTags = () =>
    fetch("/api/v1/tags")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setTags(d.data);
      });

  const fetchKnowledges = useCallback(
    (q: string, tagsFilter: string[], mode: "and" | "or") => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (tagsFilter.length > 0) {
        params.set("tags", tagsFilter.join(","));
        params.set("tagMode", mode);
      }
      const url = params.toString()
        ? `/api/v1/knowledges?${params.toString()}`
        : "/api/v1/knowledges";
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setKnowledges(d.data.knowledges);
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
      });
    fetchTags();
    fetchKnowledges("", [], "or");
  }, [fetchKnowledges]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchKnowledges(keyword, selectedTags, tagMode);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [keyword, selectedTags, tagMode, fetchKnowledges]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <ListPageHeader
        title="知识资源库"
        keyword={keyword}
        onKeywordChange={setKeyword}
        onCreate={
          user?.role === "ADMIN"
            ? () => router.push("/knowledges/new")
            : undefined
        }
        createLabel="新建知识"
      >
        {tags.length > 0 && (
          <div className="flex items-center gap-2">
            <TagFilter
              tags={tags}
              selectedTags={selectedTags}
              tagMode={tagMode}
              onTagsChange={setSelectedTags}
              onTagModeChange={setTagMode}
              placeholder="标签筛选"
              immediate={true}
            />
            <SelectedTagsDisplay
              tags={selectedTags}
              onRemove={(t) =>
                setSelectedTags(selectedTags.filter((x) => x !== t))
              }
            />
          </div>
        )}
      </ListPageHeader>

      <div className="flex-1 overflow-auto">
        {loading && knowledges.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            加载中...
          </div>
        ) : knowledges.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <BookOpen className="w-16 h-16 mb-4 text-gray-300" />
            <p className="mb-2">暂无知识</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
            {knowledges.map((k) => (
              <Card
                key={k.id}
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => router.push(`/knowledges/${k.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <BookOpen className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <h3 className="font-semibold text-gray-900 truncate">
                      {k.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 h-10 mb-2">
                    {k.description || "暂无描述"}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-2 min-h-[20px]">
                    {(k.tags || []).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{k.creatorName || "-"}</span>
                    <span>
                      {k.updatedAt
                        ? new Date(k.updatedAt).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 `knowledges/new/page.tsx`**

```tsx
"use client";

import { KnowledgeEditor } from "@/components/knowledge/knowledge-editor";

export default function NewKnowledgePage() {
  return <KnowledgeEditor mode="create" />;
}
```

- [ ] **Step 3: 创建 `knowledges/[id]/page.tsx`（详情只读 + 编辑入口）**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface KnowledgeDetail {
  id: string;
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  creatorName?: string;
}

export default function KnowledgeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [knowledge, setKnowledge] = useState<KnowledgeDetail | null>(null);
  const [user, setUser] = useState<{ role?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
      });
    if (id)
      fetch(`/api/v1/knowledges/${id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setKnowledge(d.data);
        });
  }, [id]);

  if (!knowledge)
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        加载中...
      </div>
    );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/knowledges"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← 返回知识库
          </Link>
          <h1 className="text-2xl font-bold mt-1">{knowledge.name}</h1>
        </div>
        {user?.role === "ADMIN" && (
          <Button
            variant="outline"
            onClick={() => router.push(`/knowledges/${id}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            编辑
          </Button>
        )}
      </div>

      {knowledge.description && (
        <p className="text-gray-600 mb-4">{knowledge.description}</p>
      )}

      {knowledge.tags && knowledge.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {knowledge.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm mb-6 text-gray-500">
        <div>发布人:</div>
        <div>{knowledge.creatorName || "-"}</div>
        <div>创建时间:</div>
        <div>
          {knowledge.createdAt
            ? new Date(knowledge.createdAt).toLocaleDateString()
            : "-"}
        </div>
        <div>更新时间:</div>
        <div>
          {knowledge.updatedAt
            ? new Date(knowledge.updatedAt).toLocaleDateString()
            : "-"}
        </div>
      </div>

      {knowledge.content && (
        <div>
          <div className="text-sm font-medium mb-2">内容</div>
          <div className="text-sm prose prose-sm max-w-none border rounded-md p-4 bg-gray-50">
            <ReactMarkdown>{knowledge.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 创建 `knowledges/[id]/edit/page.tsx`**

```tsx
"use client";

import { useParams } from "next/navigation";
import { KnowledgeEditor } from "@/components/knowledge/knowledge-editor";

export default function EditKnowledgePage() {
  const params = useParams();
  const id = params.id as string;
  return <KnowledgeEditor mode="edit" knowledgeId={id} />;
}
```

- [ ] **Step 5: 冒烟验证**

Run: `cd backend && pnpm dev`
浏览器手动验证清单：
1. `/knowledges` → 卡片墙渲染，搜索 + 标签筛选防抖生效；ADMIN 看到「新建知识」
2. `/knowledges/new` → 填名称+内容，TagInput 回车加标签，右侧实时预览；保存 → 跳详情
3. 详情页：描述/标签/内容渲染正确；ADMIN 见「编辑」
4. `/knowledges/[id]/edit` → 预填正确；改内容保存 → 若有关联 Agent 弹「更新关联 Agent 版本」→ 选/跳过 → 回详情
5. 从 Agent 编辑器「添加知识」选择器的「新建知识」链接能新标签打开 `/knowledges/new`

- [ ] **Step 6: lint 验证**

Run: `cd backend && pnpm lint`
Expected: 无 error

- [ ] **Step 7: Commit**

```bash
git add backend/src/app/\(dashboard\)/knowledges/
git commit -m "feat(web): Knowledge 改卡片墙 + new/detail/edit 全屏页"
```

---

### Task 8: 清理与回归验证

**Files:**
- Audit: `backend/src/app/(dashboard)/agents/page.tsx`、`backend/src/app/(dashboard)/knowledges/page.tsx`（确认旧的内嵌向导/弹窗代码已彻底移除）
- Audit: `backend/src/app/(dashboard)/my/page.tsx`、`backend/src/app/(dashboard)/upload/page.tsx`（确认未被破坏的引用）

**Interfaces:**
- 无新增；纯校验。

- [ ] **Step 1: 确认旧代码已移除**

检查 `agents/page.tsx` 不再含 `createStep`、`renderStepIndicator`、`renderStep2Skills`、`renderStep3Knowledge`、`showCreateSkill`、`showCreateKnowledge`、`renderCreatePanel`、`renderViewPanel`。
检查 `knowledges/page.tsx` 不再含 `editModalOpen`、`versionModalOpen`（版本逻辑已迁入 KnowledgeEditor）。
Run: `cd backend && grep -n "createStep\|renderStep\|showCreateSkill\|editModalOpen" src/app/\(dashboard\)/agents/page.tsx src/app/\(dashboard\)/knowledges/page.tsx`
Expected: 无输出（旧代码已清除）

- [ ] **Step 2: 确认未误伤其它页面**

Run: `cd backend && grep -rn "from \"@/app/(dashboard)/agents" src/ ; grep -rn "from \"@/app/(dashboard)/knowledges" src/`
Expected: 无跨页内部引用（页面只被路由消费，不应被 import）

- [ ] **Step 3: 全量 lint**

Run: `cd backend && pnpm lint`
Expected: 无 error

- [ ] **Step 4: 全链路回归冒烟**

Run: `cd backend && pnpm dev`
回归清单：
1. Agent：列表 → 新建（绑能力+知识，含 kind 切换）→ 详情 → 编辑（增减绑定）→ 下载 → 删除
2. Knowledge：列表 → 新建（含标签）→ 详情 → 编辑（含关联版本更新）→（ADMIN）删除若有
3. Skill 页 `/skills` 未受影响，仍可下载
4. `/my` 我的资源、`/upload` 资源上传仍正常打开
5. append-only 绑定语义未被破坏（绑定只增版本、软删）

- [ ] **Step 5: Commit（如有清理改动）**

```bash
git add -A backend/src
git commit -m "chore(web): 清理旧向导/弹窗代码，回归验证通过"
```

---

## Self-Review（plan 写完后自检，已执行）

1. **Spec 覆盖**：路由拆分(§4)→Task 5/7；卡片墙(§5)→Task 5/7；两栏编辑器(§6)→Task 4/6；已绑清单+选择器(§7)→Task 2/3/4；组件拆分(§8)→Task 1-7；数据流/append-only(§9)→Task 4/6；错误态(§10)→各 editor 内联；验证(§11)→每任务冒烟+Task 8 回归。Skill 不动(§非目标)→全局约束。✅
2. **占位符扫描**：无 TBD/TODO/「类似 Task N」。✅
3. **类型一致性**：`BoundSkill`/`BoundKnowledge`/`KnowledgeKind`/`PickerItem` 在 Task 2/3 定义，Task 4 消费；`AgentEditor({mode,agentId})`、`KnowledgeEditor({mode,knowledgeId})` 在 Task 4/6 定义，Task 5/7 消费。命名一致。✅
4. **已知取舍**：Knowledge 编辑权限沿用 ADMIN 门控（不改后端鉴权），已在 Task 7 Interfaces 注明。MarkdownEditor 组件在 Task 1 建出但 Knowledge 编辑器右栏用轻量预览，已在 Task 6 说明（避免重复编辑框）。
