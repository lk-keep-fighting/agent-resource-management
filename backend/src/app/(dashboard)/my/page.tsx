"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Trash2, X, Package, BookOpen, User, Settings as SettingsIcon, Edit, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type TabType = "skill" | "knowledge" | "settings";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  license?: string;
  downloadCount: number;
  publishedAt: string;
  tags: string[];
}

interface SkillDetail extends Skill {
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  fileSize: number;
  fileHash: string;
  content: string | null;
}

interface Knowledge {
  id: string;
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export default function MyPage() {
  const [activeTab, setActiveTab] = useState<TabType>("skill");

  const [user, setUser] = useState<UserInfo | null>(null);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [skillDetailCache, setSkillDetailCache] = useState<Record<string, SkillDetail>>({});
  const [skillDetailLoading, setSkillDetailLoading] = useState(false);

  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [knowledgesLoading, setKnowledgesLoading] = useState(true);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", content: "", tags: [] as string[] });
  const [editSaving, setEditSaving] = useState(false);
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);

  const [linkedAgents, setLinkedAgents] = useState<{ agentId: string; agentName: string; agentVersion: string }[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionUpdating, setVersionUpdating] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        }
      });
  }, []);

  const fetchSkills = useCallback(async () => {
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/v1/users/me/skills");
      const data = await res.json();
      if (data.ok) {
        setSkills(data.data);
      }
    } catch {
      console.error("Failed to fetch skills");
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  const fetchKnowledges = useCallback(async () => {
    setKnowledgesLoading(true);
    try {
      const res = await fetch("/api/v1/users/me/knowledges");
      const data = await res.json();
      if (data.ok) {
        setKnowledges(data.data);
      }
    } catch {
      console.error("Failed to fetch knowledges");
    } finally {
      setKnowledgesLoading(false);
    }
  }, []);

  const fetchLinkedAgents = useCallback(async (knowledgeId: string) => {
    try {
      const res = await fetch(`/api/v1/knowledges/${knowledgeId}/agents`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setLinkedAgents(data.data);
        setSelectedAgentIds(data.data.map((a: { agentId: string }) => a.agentId));
      } else {
        setLinkedAgents([]);
        setSelectedAgentIds([]);
      }
    } catch {
      console.error("Failed to fetch linked agents");
      setLinkedAgents([]);
      setSelectedAgentIds([]);
    }
  }, []);

  const fetchSkillDetail = useCallback(async (name: string) => {
    if (skillDetailCache[name]) {
      return;
    }
    setSkillDetailLoading(true);
    try {
      const res = await fetch(`/api/v1/skills/${name}`);
      const data = await res.json();
      if (data.ok) {
        setSkillDetailCache((prev) => ({ ...prev, [name]: data.data }));
      }
    } catch {
      console.error("Failed to fetch skill detail");
    } finally {
      setSkillDetailLoading(false);
    }
  }, [skillDetailCache]);

  useEffect(() => {
    fetchSkills();
    fetchKnowledges();
  }, []);

  useEffect(() => {
    if (selectedSkillName) {
      fetchSkillDetail(selectedSkillName);
    }
  }, [selectedSkillName, fetchSkillDetail]);

  const handleDeleteSkill = async (name: string) => {
    if (!confirm(`确定要删除 ${name} 吗？`)) return;

    try {
      const res = await fetch(`/api/v1/skills/${name}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        if (selectedSkillName === name) {
          setSelectedSkillName(null);
        }
        fetchSkills();
      } else {
        alert(data.msg || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    if (!confirm("确定要删除这个知识吗？")) return;

    try {
      const res = await fetch(`/api/v1/knowledges/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        if (selectedKnowledgeId === id) {
          setSelectedKnowledgeId(null);
        }
        fetchKnowledges();
      } else {
        alert(data.msg || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const handleEditKnowledge = (knowledge: Knowledge) => {
    setEditingKnowledgeId(knowledge.id);
    setEditForm({
      name: knowledge.name || "",
      description: knowledge.description || "",
      content: knowledge.content || "",
      tags: knowledge.tags || [],
    });
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingKnowledgeId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/v1/knowledges/${editingKnowledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.ok) {
        setKnowledges((prev) =>
          prev.map((k) =>
            k.id === editingKnowledgeId ? { ...k, ...editForm, updatedAt: new Date().toISOString() } : k
          )
        );
        setSelectedKnowledgeId(null);
        setEditModalOpen(false);
        fetchKnowledges();

        await fetchLinkedAgents(editingKnowledgeId);
        if (linkedAgents.length > 0) {
          setVersionModalOpen(true);
        }
      } else {
        alert(data.message || "保存失败");
      }
    } catch {
      console.error("Failed to save knowledge");
      alert("保存失败");
    } finally {
      setEditSaving(false);
    }
  };

  const handleVersionUpdate = async () => {
    if (selectedAgentIds.length === 0) {
      setVersionModalOpen(false);
      return;
    }
    setVersionUpdating(true);
    try {
      const res = await fetch("/api/v1/agents/batch-version", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentIds: selectedAgentIds,
          knowledgeId: editingKnowledgeId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert(`已更新 ${data.data.updatedAgents.length} 个Agent版本`);
      } else {
        alert(data.message || "版本更新失败");
      }
    } catch {
      console.error("Failed to update agent versions");
      alert("版本更新失败");
    } finally {
      setVersionUpdating(false);
      setVersionModalOpen(false);
    }
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  const handleDownloadSkill = async (name: string) => {
    try {
      const res = await fetch(`/api/v1/skills/${name}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.zip`;
      a.click();
    } catch {
      alert("下载失败");
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedSkillName(null);
    setSelectedKnowledgeId(null);
  };

  const selectedSkill = selectedSkillName ? skillDetailCache[selectedSkillName] : null;
  const selectedKnowledge = knowledges.find(k => k.id === selectedKnowledgeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的资源</h1>
      </div>

      <div className="flex gap-1 border-b">
        <button
          onClick={() => handleTabChange("skill")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "skill"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          已发布能力
        </button>
        <button
          onClick={() => handleTabChange("knowledge")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "knowledge"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          已创建知识
        </button>
        <button
          onClick={() => handleTabChange("settings")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "settings"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <SettingsIcon className="h-4 w-4" />
          设置
        </button>
      </div>

      {activeTab === "skill" && (
        <SkillTab
          skills={skills}
          loading={skillsLoading}
          selectedSkillName={selectedSkillName}
          selectedSkill={selectedSkill}
          skillDetailLoading={skillDetailLoading}
          onSelect={setSelectedSkillName}
          onDelete={handleDeleteSkill}
          onDownload={handleDownloadSkill}
        />
      )}

      {activeTab === "knowledge" && (
        <KnowledgeTab
          knowledges={knowledges}
          loading={knowledgesLoading}
          selectedKnowledgeId={selectedKnowledgeId}
          onSelect={setSelectedKnowledgeId}
          onDelete={handleDeleteKnowledge}
          onEdit={handleEditKnowledge}
        />
      )}

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>编辑知识</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">名称</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="请输入知识名称"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">描述</label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="请输入描述"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">内容</label>
              <textarea
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={editForm.content}
                onChange={(e) => setEditForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="请输入知识内容 (支持 Markdown)"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">标签 (逗号分隔)</label>
              <Input
                value={editForm.tags.join(", ")}
                onChange={(e) => setEditForm((prev) => ({
                  ...prev,
                  tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                }))}
                placeholder="例如：api, python, 机器学习"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              <Save className="h-4 w-4 mr-2" />
              {editSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionModalOpen} onOpenChange={setVersionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>更新关联Agent版本</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500 mb-4">
              此知识已关联以下Agent，编辑后是否更新它们的版本号？
            </p>
            {linkedAgents.length === 0 ? (
              <p className="text-sm text-gray-400">暂无关联的Agent</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto">
                {linkedAgents.map((agent) => (
                  <label
                    key={agent.agentId}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAgentIds.includes(agent.agentId)}
                      onChange={() => toggleAgentSelection(agent.agentId)}
                      className="rounded"
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
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionModalOpen(false)} disabled={versionUpdating}>
              跳过
            </Button>
            <Button onClick={handleVersionUpdate} disabled={versionUpdating}>
              {versionUpdating ? "更新中..." : "确认更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeTab === "settings" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              账户信息
            </CardTitle>
            <CardDescription>当前登录账户信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ID:</span>
              <span>{user?.id || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">名称:</span>
              <span>{user?.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">邮箱:</span>
              <span>{user?.email || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">角色:</span>
              <span className={user?.role === "ADMIN" ? "text-red-600 font-medium" : ""}>
                {user?.role === "ADMIN" ? "管理员" : "普通用户"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SkillTab({
  skills,
  loading,
  selectedSkillName,
  selectedSkill,
  skillDetailLoading,
  onSelect,
  onDelete,
  onDownload,
}: {
  skills: Skill[];
  loading: boolean;
  selectedSkillName: string | null;
  selectedSkill: SkillDetail | null;
  skillDetailLoading: boolean;
  onSelect: (name: string | null) => void;
  onDelete: (name: string) => void;
  onDownload: (name: string) => void;
}) {
  return (
    <div className="flex gap-6 h-[calc(100vh-220px)]">
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        <div className="flex-1 overflow-auto border rounded-lg bg-white">
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">标签</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">下载量</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">发布时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && skills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : skills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    暂无发布的能力资产
                  </td>
                </tr>
              ) : (
                skills.map((skill) => (
                  <tr
                    key={skill.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedSkillName === skill.name ? 'bg-blue-50' : ''}`}
                    onClick={() => onSelect(selectedSkillName === skill.name ? null : skill.name)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600">{skill.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-500 max-w-xs truncate">{skill.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {skill.tags && skill.tags.length > 0 ? (
                          skill.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {skill.downloadCount}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {new Date(skill.publishedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSkillName && (
        <Card className="w-96 flex-shrink-0 overflow-auto">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{selectedSkillName}</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSelect(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {skillDetailLoading && !selectedSkill ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : selectedSkill ? (
              <>
                <p className="text-sm text-gray-500">{selectedSkill.description}</p>

                {selectedSkill.tags && selectedSkill.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedSkill.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500">文件大小:</div>
                  <div>{(selectedSkill.fileSize / 1024).toFixed(1)} KB</div>
                  <div className="text-gray-500">下载次数:</div>
                  <div>{selectedSkill.downloadCount}</div>
                  {selectedSkill.license && (
                    <>
                      <div className="text-gray-500">许可:</div>
                      <div>{selectedSkill.license}</div>
                    </>
                  )}
                  {selectedSkill.compatibility && (
                    <>
                      <div className="text-gray-500">兼容性:</div>
                      <div>{selectedSkill.compatibility}</div>
                    </>
                  )}
                </div>

                {selectedSkill.allowedTools && selectedSkill.allowedTools.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-500 mb-2">允许的工具:</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedSkill.allowedTools.map((tool) => (
                        <span
                          key={tool}
                          className="text-xs px-2 py-1 bg-gray-100 rounded"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSkill.content && (
                  <div>
                    <div className="text-sm font-medium mb-2">能力说明:</div>
                    <div className="text-sm prose prose-sm max-w-none border-t pt-2">
                      <ReactMarkdown>{selectedSkill.content}</ReactMarkdown>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => onDownload(selectedSkill.name)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    下载
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => onDelete(selectedSkill.name)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KnowledgeTab({
  knowledges,
  loading,
  selectedKnowledgeId,
  onSelect,
  onDelete,
  onEdit,
}: {
  knowledges: Knowledge[];
  loading: boolean;
  selectedKnowledgeId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onEdit: (knowledge: Knowledge) => void;
}) {
  const selectedKnowledge = knowledges.find(k => k.id === selectedKnowledgeId);

  return (
    <div className="flex gap-6 h-[calc(100vh-220px)]">
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        <div className="flex-1 overflow-auto border rounded-lg bg-white">
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">标签</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && knowledges.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : knowledges.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    暂无创建的知识资源
                  </td>
                </tr>
              ) : (
                knowledges.map((knowledge) => (
                  <tr
                    key={knowledge.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedKnowledgeId === knowledge.id ? 'bg-blue-50' : ''}`}
                    onClick={() => onSelect(selectedKnowledgeId === knowledge.id ? null : knowledge.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600">{knowledge.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-500 max-w-xs truncate">{knowledge.description || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {knowledge.tags && knowledge.tags.length > 0 ? (
                          knowledge.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {new Date(knowledge.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedKnowledgeId && selectedKnowledge && (
        <Card className="w-96 flex-shrink-0 overflow-auto">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{selectedKnowledge.name}</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSelect(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedKnowledge.description && (
              <p className="text-sm text-gray-500">{selectedKnowledge.description}</p>
            )}

            {selectedKnowledge.tags && selectedKnowledge.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedKnowledge.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500">创建时间:</div>
              <div>{new Date(selectedKnowledge.createdAt).toLocaleDateString()}</div>
              <div className="text-gray-500">更新时间:</div>
              <div>{new Date(selectedKnowledge.updatedAt).toLocaleDateString()}</div>
            </div>

            {selectedKnowledge.content && (
              <div>
                <div className="text-sm font-medium mb-2">内容:</div>
                <div className="text-sm prose prose-sm max-w-none border-t pt-2 max-h-64 overflow-auto">
                  <ReactMarkdown>{selectedKnowledge.content}</ReactMarkdown>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => onEdit(selectedKnowledge)}
              >
                <Edit className="h-4 w-4 mr-2" />
                编辑
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                onClick={() => onDelete(selectedKnowledge.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
