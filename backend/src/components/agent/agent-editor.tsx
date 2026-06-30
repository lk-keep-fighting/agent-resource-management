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
