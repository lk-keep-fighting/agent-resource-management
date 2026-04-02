"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Search, Pencil, Trash2, Bot, BookOpen, Wrench } from "lucide-react";

interface AgentSkill {
  skillId: string;
  skill: {
    id: string;
    name: string;
    description: string;
    allowedTools?: string[];
  };
  config?: Record<string, unknown>;
}

interface AgentKnowledge {
  knowledgeId: string;
  name: string;
  description?: string;
  retrievalConfig?: {
    topK?: number;
    similarityThreshold?: number;
  };
}

interface Agent {
  id: string;
  name: string;
  description: string;
  prompt: string;
  avatar?: string;
  status: "active" | "draft";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  skills?: AgentSkill[];
  knowledges?: AgentKnowledge[];
}

interface Skill {
  id: string;
  name: string;
  description: string;
}

interface Knowledge {
  id: string;
  name: string;
  description?: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showSkillSelector, setShowSkillSelector] = useState(false);
  const [showKnowledgeSelector, setShowKnowledgeSelector] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [filteredKnowledges, setFilteredKnowledges] = useState<Knowledge[]>([]);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    prompt: "",
    status: "active" as "active" | "draft",
  });

  const [boundSkills, setBoundSkills] = useState<AgentSkill[]>([]);
  const [boundKnowledges, setBoundKnowledges] = useState<AgentKnowledge[]>([]);
  const [saveError, setSaveError] = useState("");

  const fetchAgents = useCallback(async (searchKeyword = "") => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const params = new URLSearchParams();
      if (searchKeyword) params.set("keyword", searchKeyword);
      const queryString = params.toString();
      const url = queryString ? `/api/v1/agents?${queryString}` : "/api/v1/agents";

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setAgents(data.data.agents);
      }
    } catch {
      console.error("Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchSkills = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/skills?pageSize=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSkills(data.data.skills);
        setFilteredSkills(data.data.skills);
      }
    } catch {
      console.error("Failed to fetch skills");
    }
  };

  const searchSkills = (keyword: string) => {
    setSkillSearch(keyword);
    if (!keyword.trim()) {
      setFilteredSkills(skills);
      return;
    }
    const filtered = skills.filter(s =>
      s.name.toLowerCase().includes(keyword.toLowerCase()) ||
      s.description.toLowerCase().includes(keyword.toLowerCase())
    );
    setFilteredSkills(filtered);
  };

  const fetchKnowledges = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/knowledges?pageSize=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setKnowledges(data.data.knowledges || []);
        setFilteredKnowledges(data.data.knowledges || []);
      }
    } catch {
      console.error("Failed to fetch knowledges");
      setKnowledges([]);
      setFilteredKnowledges([]);
    }
  };

  const searchKnowledges = async (keyword: string) => {
    setKnowledgeSearch(keyword);
    if (!keyword.trim()) {
      setFilteredKnowledges(knowledges);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/knowledges?search=${encodeURIComponent(keyword)}&pageSize=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setFilteredKnowledges(data.data.knowledges || []);
      }
    } catch {
      console.error("Failed to search knowledges");
      const filtered = knowledges.filter(k => 
        k.name.toLowerCase().includes(keyword.toLowerCase()) ||
        k.description?.toLowerCase().includes(keyword.toLowerCase())
      );
      setFilteredKnowledges(filtered);
    }
  };

  const fetchAgentDetail = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/agents/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        return data.data;
      }
    } catch {
      console.error("Failed to fetch agent detail");
    }
    return null;
  };

  useEffect(() => {
    fetchAgents();
    fetchSkills();
    fetchKnowledges();
  }, [fetchAgents]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAgents(keyword);
  };

  const handleAgentClick = async (agent: Agent) => {
    const detail = await fetchAgentDetail(agent.id);
    if (detail) {
      setSelectedAgent(detail);
      setFormData({
        name: detail.name,
        description: detail.description,
        prompt: detail.prompt,
        status: detail.status,
      });
      setBoundSkills(detail.skills || []);
      setBoundKnowledges(detail.knowledges || []);
      setIsEditing(false);
      setIsCreating(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedAgent(null);
    setIsCreating(true);
    setIsEditing(true);
    setFormData({ name: "", description: "", prompt: "", status: "active" });
    setBoundSkills([]);
    setBoundKnowledges([]);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setSelectedAgent(null);
    setIsCreating(false);
    setIsEditing(false);
    setShowSkillSelector(false);
    setShowKnowledgeSelector(false);
  };

  const handleSave = async () => {
    setSaveError("");
    try {
      const token = localStorage.getItem("token");
      console.log("Token from localStorage:", token);
      if (!token) {
        console.log("No token found, redirecting to login");
        router.push("/login");
        return;
      }

      if (isCreating) {
        const res = await fetch("/api/v1/agents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });
        console.log("Create agent response status:", res.status);
        const data = await res.json();
        console.log("Create agent response data:", data);
        if (data.ok) {
          const newAgent = await fetchAgentDetail(data.data.id);
          if (newAgent) {
            await bindSkillsAndKnowledges(data.data.id);
            fetchAgents();
            setSelectedAgent(newAgent);
            setIsCreating(false);
          }
        } else {
          setSaveError(data.msg || "创建失败");
          return;
        }
      } else if (selectedAgent) {
        const res = await fetch(`/api/v1/agents/${selectedAgent.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data.ok) {
          await bindSkillsAndKnowledges(selectedAgent.id);
          const detail = await fetchAgentDetail(selectedAgent.id);
          if (detail) {
            setSelectedAgent(detail);
          }
          fetchAgents();
          setIsEditing(false);
        } else {
          setSaveError(data.msg || "保存失败");
          return;
        }
      }
    } catch {
      setSaveError("网络错误");
    }
  };

  const bindSkillsAndKnowledges = async (agentId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    for (const skill of boundSkills) {
      await fetch(`/api/v1/agents/${agentId}/skills`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ skillId: skill.skillId, config: skill.config }),
      });
    }

    for (const knowledge of boundKnowledges) {
      await fetch(`/api/v1/agents/${agentId}/knowledges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ knowledgeId: knowledge.knowledgeId, retrievalConfig: knowledge.retrievalConfig }),
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedAgent) return;
    if (!confirm("确定要删除这个Agent吗？")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/agents/${selectedAgent.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        fetchAgents();
        handleCancel();
      }
    } catch {
      console.error("Failed to delete agent");
    }
  };

  const handleToggleSkill = (skill: Skill) => {
    const exists = boundSkills.find((s) => s.skillId === skill.id);
    if (exists) {
      setBoundSkills(boundSkills.filter((s) => s.skillId !== skill.id));
    } else {
      setBoundSkills([...boundSkills, { skillId: skill.id, skill }]);
    }
  };

  const handleCloseSkillSelector = () => {
    setShowSkillSelector(false);
    setSkillSearch("");
  };

  const handleRemoveSkill = (skillId: string) => {
    setBoundSkills(boundSkills.filter((s) => s.skillId !== skillId));
  };

  const handleToggleKnowledge = (knowledge: Knowledge) => {
    const exists = boundKnowledges.find((k) => k.knowledgeId === knowledge.id);
    if (exists) {
      setBoundKnowledges(boundKnowledges.filter((k) => k.knowledgeId !== knowledge.id));
    } else {
      setBoundKnowledges([
        ...boundKnowledges,
        { knowledgeId: knowledge.id, name: knowledge.name, description: knowledge.description, retrievalConfig: { topK: 5 } },
      ]);
    }
  };

  const handleCloseKnowledgeSelector = () => {
    setShowKnowledgeSelector(false);
    setKnowledgeSearch("");
  };

  const handleRemoveKnowledge = (knowledgeId: string) => {
    setBoundKnowledges(boundKnowledges.filter((k) => k.knowledgeId !== knowledgeId));
  };

  const handleUpdateKnowledgeTopK = (knowledgeId: string, topK: number) => {
    setBoundKnowledges(
      boundKnowledges.map((k) =>
        k.knowledgeId === knowledgeId
          ? { ...k, retrievalConfig: { ...k.retrievalConfig, topK } }
          : k
      )
    );
  };

  const closeSelectors = () => {
    setShowSkillSelector(false);
    setShowKnowledgeSelector(false);
    setSkillSearch("");
    setFilteredSkills(skills);
    setKnowledgeSearch("");
    setFilteredKnowledges(knowledges);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* Agent List */}
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Agent 管理</h1>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            新建 Agent
          </Button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="搜索 Agent..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4 mr-2" />
            搜索
          </Button>
        </form>

        <div className="flex-1 overflow-auto border rounded-lg bg-white">
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">描述</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">状态</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">技能</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">知识</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && agents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    暂无 Agent，点击&quot;新建 Agent&quot;创建
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr
                    key={agent.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedAgent?.id === agent.id ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleAgentClick(agent)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-blue-500" />
                        <span className="font-medium text-blue-600">{agent.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-500 max-w-xs truncate">
                        {agent.description || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                          agent.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {agent.status === "active" ? "启用" : "停用"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">-</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">-</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {(selectedAgent || isCreating) && (
        <Card className="w-[500px] flex-shrink-0 overflow-auto">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {isCreating ? "新建 Agent" : selectedAgent?.name}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">名称</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Agent 名称"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">描述</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Agent 描述"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">角色定义 Prompt</label>
                  <textarea
                    className="w-full min-h-[120px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    placeholder="定义 Agent 的角色和行为..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">状态</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.status === "active"}
                        onChange={() => setFormData({ ...formData, status: "active" })}
                      />
                      <span className="text-sm">启用</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.status === "draft"}
                        onChange={() => setFormData({ ...formData, status: "draft" })}
                      />
                      <span className="text-sm">停用</span>
                    </label>
                  </div>
                </div>

                {/* Bound Skills */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Wrench className="h-4 w-4" /> 已绑定技能
                    </label>
                    <Button size="sm" variant="outline" onClick={() => setShowSkillSelector(true)}>
                      <Plus className="h-3 w-3 mr-1" /> 添加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {boundSkills.length === 0 ? (
                      <span className="text-sm text-gray-400">暂未绑定技能</span>
                    ) : (
                      boundSkills.map((s) => (
                        <span
                          key={s.skillId}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-sm rounded"
                        >
                          {s.skill.name}
                          <button
                            onClick={() => handleRemoveSkill(s.skillId)}
                            className="hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Bound Knowledges */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <BookOpen className="h-4 w-4" /> 已关联知识
                    </label>
                    <Button size="sm" variant="outline" onClick={() => setShowKnowledgeSelector(true)}>
                      <Plus className="h-3 w-3 mr-1" /> 添加
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {boundKnowledges.length === 0 ? (
                      <span className="text-sm text-gray-400">暂未关联知识</span>
                    ) : (
                      boundKnowledges.map((k) => (
                        <div
                          key={k.knowledgeId}
                          className="flex items-center justify-between px-3 py-2 bg-green-50 text-green-700 text-sm rounded"
                        >
                          <div>
                            <div className="font-medium">{k.name}</div>
                            {k.description && (
                              <div className="text-xs text-green-600/70 mt-0.5 truncate max-w-[200px]">{k.description}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">topK:</span>
                            <Input
                              type="number"
                              className="w-12 h-6 text-xs"
                              value={k.retrievalConfig?.topK || 5}
                              onChange={(e) =>
                                handleUpdateKnowledgeTopK(k.knowledgeId, parseInt(e.target.value) || 5)
                              }
                            />
                            <button
                              onClick={() => handleRemoveKnowledge(k.knowledgeId)}
                              className="hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" onClick={handleSave}>
                    保存
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleCancel}>
                    取消
                  </Button>
                </div>
                {saveError && (
                  <p className="text-sm text-red-500 text-center pt-2">{saveError}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">{selectedAgent?.description || "暂无描述"}</p>

                <div className="space-y-2">
                  <label className="text-sm font-medium">状态</label>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                      selectedAgent?.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {selectedAgent?.status === "active" ? "启用" : "停用"}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">角色定义</label>
                  <div className="p-3 bg-gray-50 rounded text-sm max-h-40 overflow-auto">
                    {selectedAgent?.prompt || "暂无"}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Wrench className="h-4 w-4" /> 已绑定技能 ({boundSkills.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {boundSkills.length === 0 ? (
                      <span className="text-sm text-gray-400">暂无</span>
                    ) : (
                      boundSkills.map((s) => (
                        <span
                          key={s.skillId}
                          className="px-2 py-1 bg-blue-50 text-blue-600 text-sm rounded"
                        >
                          {s.skill.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <BookOpen className="h-4 w-4" /> 已关联知识 ({boundKnowledges.length})
                  </label>
                  <div className="flex flex-col gap-2">
                    {boundKnowledges.length === 0 ? (
                      <span className="text-sm text-gray-400">暂无</span>
                    ) : (
                      boundKnowledges.map((k) => (
                        <div
                          key={k.knowledgeId}
                          className="px-3 py-2 bg-green-50 text-green-700 text-sm rounded"
                        >
                          <div className="font-medium">{k.name}</div>
                          {k.description && (
                            <div className="text-xs text-green-600/70 mt-0.5">{k.description}</div>
                          )}
                          {k.retrievalConfig?.topK && (
                            <div className="text-xs mt-1">topK: {k.retrievalConfig.topK}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={handleEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    编辑
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Skill Selector Modal */}
      {showSkillSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCloseSkillSelector}>
          <div className="bg-white rounded-lg w-[480px] max-h-[600px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium">选择技能 ({boundSkills.length} 已选)</h3>
              <Button size="sm" variant="ghost" onClick={handleCloseSkillSelector}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 border-b">
              <Input
                placeholder="搜索技能..."
                value={skillSearch}
                onChange={(e) => searchSkills(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-auto p-4">
              {filteredSkills.length === 0 ? (
                <p className="text-center text-gray-500 py-4">暂无可用技能</p>
              ) : (
                <div className="space-y-2">
                  {filteredSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className={`p-3 border rounded cursor-pointer transition-colors flex items-start gap-3 ${
                        boundSkills.some(s => s.skillId === skill.id)
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleToggleSkill(skill)}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        boundSkills.some(s => s.skillId === skill.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {boundSkills.some(s => s.skillId === skill.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{skill.name}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">{skill.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <Button className="w-full" onClick={handleCloseSkillSelector}>
                确认 ({boundSkills.length})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Selector Modal */}
      {showKnowledgeSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCloseKnowledgeSelector}>
          <div className="bg-white rounded-lg w-[480px] max-h-[600px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium">选择知识 ({boundKnowledges.length} 已选)</h3>
              <Button size="sm" variant="ghost" onClick={handleCloseKnowledgeSelector}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 border-b">
              <Input
                placeholder="搜索知识..."
                value={knowledgeSearch}
                onChange={(e) => searchKnowledges(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-auto p-4">
              {filteredKnowledges.length === 0 ? (
                <p className="text-center text-gray-500 py-4">暂无可用知识</p>
              ) : (
                <div className="space-y-2">
                  {filteredKnowledges.map((knowledge) => (
                    <div
                      key={knowledge.id}
                      className={`p-3 border rounded cursor-pointer transition-colors flex items-start gap-3 ${
                        boundKnowledges.some(k => k.knowledgeId === knowledge.id)
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleToggleKnowledge(knowledge)}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        boundKnowledges.some(k => k.knowledgeId === knowledge.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {boundKnowledges.some(k => k.knowledgeId === knowledge.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{knowledge.name}</div>
                        {knowledge.description && (
                          <div className="text-xs text-gray-500 mt-1 truncate">{knowledge.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <Button className="w-full" onClick={handleCloseKnowledgeSelector}>
                确认 ({boundKnowledges.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}