"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
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

// 复用 ReactMarkdown 做只读预览（MarkdownEditor 是两栏编辑器，这里右侧只要预览）
function MarkdownPreviewOnly({ content }: { content: string }) {
  return <ReactMarkdown>{content}</ReactMarkdown>;
}

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
