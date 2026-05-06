"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Search, Pencil, Trash2, Bot, BookOpen, Wrench, Download, Check, ChevronLeft, ChevronRight, Lightbulb, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AvatarPicker, getAvatarFromConfig } from "@/components/ui/avatar-picker";

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
  content?: string;
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
  version: string;
  status: "active" | "draft";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  skills?: AgentSkill[];
  knowledges?: AgentKnowledge[];
  skillsCount?: number;
  knowledgesCount?: number;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  allowedTools?: string[];
}

interface Knowledge {
  id: string;
  name: string;
  description?: string;
  content?: string;
}

type CreateStep = 1 | 2 | 3;

interface BoundSkill {
  skillId: string;
  skill: Skill;
}

interface BoundKnowledge {
  knowledgeId: string;
  name: string;
  description?: string;
  retrievalConfig?: {
    topK: number;
  };
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
  const [createStep, setCreateStep] = useState<CreateStep>(1);

  const [showSkillSelector, setShowSkillSelector] = useState(false);
  const [showKnowledgeSelector, setShowKnowledgeSelector] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [filteredKnowledges, setFilteredKnowledges] = useState<Knowledge[]>([]);
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const [showCreateKnowledge, setShowCreateKnowledge] = useState(false);
  const [creatingSkill, setCreatingSkill] = useState({ name: "", description: "", allowedTools: "" });
  const [creatingKnowledge, setCreatingKnowledge] = useState({ name: "", description: "", content: "" });
  const [createError, setCreateError] = useState("");
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    prompt: "",
    avatar: "",
    status: "active" as "active" | "draft",
    version: "1.0.0",
  });

  const [boundSkills, setBoundSkills] = useState<BoundSkill[]>([]);
  const [boundKnowledges, setBoundKnowledges] = useState<BoundKnowledge[]>([]);
  const [saveError, setSaveError] = useState("");

  const fetchAgents = useCallback(async (searchKeyword = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchKeyword) params.set("keyword", searchKeyword);
      const queryString = params.toString();
      const url = queryString ? `/api/v1/agents?${queryString}` : "/api/v1/agents";
      const res = await fetch(url, {});
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
      const res = await fetch("/api/v1/skills?pageSize=100");
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
      const res = await fetch("/api/v1/knowledges?pageSize=100");
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
      const res = await fetch(`/api/v1/knowledges?search=${encodeURIComponent(keyword)}&pageSize=50`);
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
      const res = await fetch(`/api/v1/agents/${id}`);
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
        avatar: detail.avatar || "",
        status: detail.status,
        version: detail.version,
      });
      setBoundSkills((detail.skills || []).map((s: AgentSkill) => ({
        skillId: s.skillId,
        skill: s.skill,
      })));

      const enrichedKnowledges = (detail.knowledges || []).map((ak: AgentKnowledge) => {
        const knowledgeInfo = knowledges.find(k => k.id === ak.knowledgeId);
        return {
          knowledgeId: ak.knowledgeId,
          name: knowledgeInfo?.name || ak.knowledgeId,
          description: knowledgeInfo?.description,
          retrievalConfig: ak.retrievalConfig || { topK: 5 },
        };
      });
      setBoundKnowledges(enrichedKnowledges);
      setIsEditing(false);
      setIsCreating(false);
      setCreateStep(1);
    }
  };

  const handleCreateNew = () => {
    setSelectedAgent(null);
    setIsCreating(true);
    setIsEditing(true);
    setCreateStep(1);
    setFormData({ name: "", description: "", prompt: "", avatar: "", status: "active", version: "1.0.0" });
    setBoundSkills([]);
    setBoundKnowledges([]);
  };

  const handleCancel = () => {
    setSelectedAgent(null);
    setIsCreating(false);
    setIsEditing(false);
    setShowSkillSelector(false);
    setShowKnowledgeSelector(false);
    setShowCreateSkill(false);
    setShowCreateKnowledge(false);
    setCreateStep(1);
    setSkillSearch("");
    setKnowledgeSearch("");
    setCreatingSkill({ name: "", description: "", allowedTools: "" });
    setCreatingKnowledge({ name: "", description: "", content: "" });
  };

  const handleNextStep = () => {
    if (createStep === 1) {
      if (!formData.name.trim()) {
        setSaveError("请输入员工姓名");
        return;
      }
      if (!formData.prompt.trim()) {
        setSaveError("请输入角色定义");
        return;
      }
    }
    setSaveError("");
    if (createStep < 3) {
      setCreateStep((createStep + 1) as CreateStep);
    }
  };

  const handlePrevStep = () => {
    if (createStep > 1) {
      setCreateStep((createStep - 1) as CreateStep);
    }
  };

  const handleSave = async () => {
    setSaveError("");
    try {
      if (isCreating) {
        const res = await fetch("/api/v1/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data.ok) {
          await bindSkillsAndKnowledges(data.data.id);
          fetchAgents();
          const detail = await fetchAgentDetail(data.data.id);
          if (detail) {
            setSelectedAgent(detail);
          }
          setIsCreating(false);
          setIsEditing(false);
        } else {
          setSaveError(data.msg || "创建失败");
          return;
        }
      } else if (selectedAgent) {
        const res = await fetch(`/api/v1/agents/${selectedAgent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data.ok) {
          const currentKnowledgesRes = await fetch(`/api/v1/agents/${selectedAgent.id}/knowledges`);
          const currentKnowledgesData = await currentKnowledgesRes.json();
          const currentKnowledgeIds = (currentKnowledgesData.data || []).map((k: { knowledgeId: string }) => k.knowledgeId);
          const boundKnowledgeIds = boundKnowledges.map(k => k.knowledgeId);

          for (const knowledgeId of currentKnowledgeIds) {
            if (!boundKnowledgeIds.includes(knowledgeId)) {
              await fetch(`/api/v1/agents/${selectedAgent.id}/knowledges?knowledgeId=${knowledgeId}`, { method: "DELETE" });
            }
          }

          const currentSkillsRes = await fetch(`/api/v1/agents/${selectedAgent.id}/skills`);
          const currentSkillsData = await currentSkillsRes.json();
          const currentSkillIds = (currentSkillsData.data || []).map((s: { skillId: string }) => s.skillId);
          const boundSkillIds = boundSkills.map(s => s.skillId);

          for (const skillId of currentSkillIds) {
            if (!boundSkillIds.includes(skillId)) {
              await fetch(`/api/v1/agents/${selectedAgent.id}/skills?skillId=${skillId}`, { method: "DELETE" });
            }
          }

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
    for (const skill of boundSkills) {
      await fetch(`/api/v1/agents/${agentId}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: skill.skillId }),
      });
    }
    for (const knowledge of boundKnowledges) {
      await fetch(`/api/v1/agents/${agentId}/knowledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeId: knowledge.knowledgeId, retrievalConfig: knowledge.retrievalConfig }),
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedAgent) return;
    if (!confirm("确定要删除这个员工吗？")) return;
    try {
      const res = await fetch(`/api/v1/agents/${selectedAgent.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        fetchAgents();
        handleCancel();
      }
    } catch {
      console.error("Failed to delete agent");
    }
  };

  const handleDownload = async () => {
    if (!selectedAgent) return;
    try {
      const res = await fetch(`/api/v1/agents/${selectedAgent.id}/download`);
      if (!res.ok) {
        alert("下载失败");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedAgent.name}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      console.error("Failed to download agent");
      alert("下载失败");
    }
  };

  const handleToggleSkill = (skill: Skill) => {
    const exists = boundSkills.find(s => s.skillId === skill.id);
    if (exists) {
      setBoundSkills(boundSkills.filter(s => s.skillId !== skill.id));
    } else {
      setBoundSkills([...boundSkills, { skillId: skill.id, skill }]);
    }
  };

  const handleRemoveSkill = (skillId: string) => {
    setBoundSkills(boundSkills.filter(s => s.skillId !== skillId));
  };

  const handleToggleKnowledge = (knowledge: Knowledge) => {
    const exists = boundKnowledges.find(k => k.knowledgeId === knowledge.id);
    if (exists) {
      setBoundKnowledges(boundKnowledges.filter(k => k.knowledgeId !== knowledge.id));
    } else {
      setBoundKnowledges([
        ...boundKnowledges,
        { knowledgeId: knowledge.id, name: knowledge.name, description: knowledge.description, retrievalConfig: { topK: 5 } },
      ]);
    }
  };

  const handleRemoveKnowledge = (knowledgeId: string) => {
    setBoundKnowledges(boundKnowledges.filter(k => k.knowledgeId !== knowledgeId));
  };

  const handleCreateSkill = async () => {
    if (!creatingSkill.name.trim()) {
      setCreateError("请输入能力名称");
      return;
    }
    setCreateError("");
    try {
      const res = await fetch("/api/v1/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: creatingSkill.name,
          description: creatingSkill.description,
          allowedTools: creatingSkill.allowedTools ? creatingSkill.allowedTools.split(",").map(t => t.trim()) : [],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const newSkill = data.data;
        setSkills([...skills, newSkill]);
        setFilteredSkills([...skills, newSkill]);
        setBoundSkills([...boundSkills, { skillId: newSkill.id, skill: newSkill }]);
        setShowCreateSkill(false);
        setCreatingSkill({ name: "", description: "", allowedTools: "" });
      } else {
        setCreateError(data.msg || "创建失败");
      }
    } catch {
      setCreateError("网络错误");
    }
  };

  const handleCreateKnowledge = async () => {
    if (!creatingKnowledge.name.trim()) {
      setCreateError("请输入知识名称");
      return;
    }
    if (!creatingKnowledge.content.trim()) {
      setCreateError("请输入知识内容");
      return;
    }
    setCreateError("");
    try {
      const res = await fetch("/api/v1/knowledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: creatingKnowledge.name,
          description: creatingKnowledge.description,
          content: creatingKnowledge.content,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const newKnowledge = data.data;
        setKnowledges([...knowledges, newKnowledge]);
        setFilteredKnowledges([...knowledges, newKnowledge]);
        setBoundKnowledges([
          ...boundKnowledges,
          { knowledgeId: newKnowledge.id, name: newKnowledge.name, description: newKnowledge.description, retrievalConfig: { topK: 5 } },
        ]);
        setShowCreateKnowledge(false);
        setCreatingKnowledge({ name: "", description: "", content: "" });
      } else {
        setCreateError(data.msg || "创建失败");
      }
    } catch {
      setCreateError("网络错误");
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[
        { step: 1, label: "基本信息" },
        { step: 2, label: "能力配置" },
        { step: 3, label: "知识配置" },
      ].map(({ step, label }) => (
        <div key={step} className="flex items-center">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              createStep === step
                ? "bg-blue-500 text-white"
                : createStep > step
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {createStep > step ? <Check className="h-4 w-4" /> : step}
            <span>{label}</span>
          </div>
          {step < 3 && (
            <div className={`w-8 h-0.5 mx-1 ${createStep > step ? "bg-green-200" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1BasicInfo = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">员工姓名 *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="例如：智能客服助手"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">员工头像</label>
        <AvatarPicker
          value={formData.avatar}
          onChange={(avatar) => setFormData({ ...formData, avatar })}
          seed={formData.avatar ? JSON.parse(formData.avatar)?.seed : undefined}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">员工描述</label>
        <textarea
          className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="描述这位员工的工作职责和能力特点..."
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">角色定义 Prompt *</label>
        <textarea
          className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={formData.prompt}
          onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
          placeholder="定义这位员工的行为准则、回答风格等..."
        />
      </div>

      <div className="p-3 bg-blue-50 rounded-lg">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700">好的描述可以帮助你更好地管理和识别这位员工</p>
        </div>
      </div>
    </div>
  );

  const renderStep2Skills = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        这位员工可以做什么？（可多选）
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="搜索能力..."
          value={skillSearch}
          onChange={(e) => searchSkills(e.target.value)}
          className="pl-10"
        />
      </div>

      {boundSkills.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase">已选择 ({boundSkills.length})</div>
          <div className="space-y-2">
            {boundSkills.map((s) => (
              <div key={s.skillId} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="font-medium text-sm">{s.skill.name}</div>
                    <div className="text-xs text-gray-500">{s.skill.description}</div>
                  </div>
                </div>
                <button onClick={() => handleRemoveSkill(s.skillId)} className="text-gray-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-500 uppercase">可选能力</div>
        <div className="space-y-2 max-h-[200px] overflow-auto">
          {filteredSkills.filter(s => !boundSkills.some(b => b.skillId === s.id)).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">暂无可选能力</p>
          ) : (
            filteredSkills.filter(s => !boundSkills.some(b => b.skillId === s.id)).map((skill) => (
              <div
                key={skill.id}
                onClick={() => handleToggleSkill(skill)}
                className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center">
                    {boundSkills.some(s => s.skillId === skill.id) && (
                      <Check className="h-3 w-3 text-blue-500" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{skill.name}</div>
                    <div className="text-xs text-gray-500">{skill.description}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-2 border-t">
        <Button variant="outline" className="w-full" onClick={() => setShowCreateSkill(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建新能力
        </Button>
      </div>
    </div>
  );

  const renderStep3Knowledge = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        这位员工需要了解哪些知识？（可多选）
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="搜索知识..."
          value={knowledgeSearch}
          onChange={(e) => searchKnowledges(e.target.value)}
          className="pl-10"
        />
      </div>

      {boundKnowledges.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase">已选择 ({boundKnowledges.length})</div>
          <div className="space-y-2">
            {boundKnowledges.map((k) => (
              <div key={k.knowledgeId} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="font-medium text-sm">{k.name}</div>
                    {k.description && <div className="text-xs text-gray-500">{k.description}</div>}
                  </div>
                </div>
                <button onClick={() => handleRemoveKnowledge(k.knowledgeId)} className="text-gray-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-500 uppercase">可选知识</div>
        <div className="space-y-2 max-h-[200px] overflow-auto">
          {filteredKnowledges.filter(k => !boundKnowledges.some(b => b.knowledgeId === k.id)).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">暂无可选知识</p>
          ) : (
            filteredKnowledges.filter(k => !boundKnowledges.some(b => b.knowledgeId === k.id)).map((knowledge) => (
              <div
                key={knowledge.id}
                onClick={() => handleToggleKnowledge(knowledge)}
                className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center">
                    {boundKnowledges.some(k => k.knowledgeId === knowledge.id) && (
                      <Check className="h-3 w-3 text-blue-500" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{knowledge.name}</div>
                    {knowledge.description && <div className="text-xs text-gray-500">{knowledge.description}</div>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-2 border-t">
        <Button variant="outline" className="w-full" onClick={() => setShowCreateKnowledge(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建新知识
        </Button>
      </div>
    </div>
  );

  const renderCreatePanel = () => (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {isCreating ? "新建员工" : `编辑 ${selectedAgent?.name}`}
        </h2>
        <Button size="sm" variant="ghost" onClick={handleCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {renderStepIndicator()}

      <div className="flex-1 overflow-auto">
        {createStep === 1 && renderStep1BasicInfo()}
        {createStep === 2 && renderStep2Skills()}
        {createStep === 3 && renderStep3Knowledge()}
      </div>

      {saveError && (
        <p className="text-sm text-red-500 text-center py-2">{saveError}</p>
      )}

      <div className="flex gap-2 pt-4 border-t">
        {createStep > 1 && (
          <Button variant="outline" onClick={handlePrevStep}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            上一步
          </Button>
        )}
        {createStep < 3 ? (
          <Button className="flex-1" onClick={handleNextStep}>
            下一步
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button className="flex-1" onClick={handleSave}>
            <Check className="h-4 w-4 mr-1" />
            完成
          </Button>
        )}
        <Button variant="outline" onClick={handleCancel}>
          取消
        </Button>
      </div>
    </div>
  );

  const renderViewPanel = () => (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{selectedAgent?.name}</h2>
        <Button size="sm" variant="ghost" onClick={handleCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto space-y-4">
        <div className="flex items-center gap-4">
          {selectedAgent?.avatar && (
            <img
              src={getAvatarFromConfig(selectedAgent.avatar)}
              alt=""
              className="w-16 h-16 rounded-xl object-contain bg-gray-100"
            />
          )}
          <div>
            <p className="text-gray-600">{selectedAgent?.description || "暂无描述"}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                selectedAgent?.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {selectedAgent?.status === "active" ? "启用" : "停用"}
              </span>
              <span className="text-xs text-gray-500">v{selectedAgent?.version}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            <Wrench className="h-4 w-4" /> 能力 ({boundSkills.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {boundSkills.length === 0 ? (
              <span className="text-sm text-gray-400">暂无</span>
            ) : (
              boundSkills.map((s) => (
                <span key={s.skillId} className="px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded-full">
                  {s.skill.name}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            <BookOpen className="h-4 w-4" /> 知识 ({boundKnowledges.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {boundKnowledges.length === 0 ? (
              <span className="text-sm text-gray-400">暂无</span>
            ) : (
              boundKnowledges.map((k) => (
                <span key={k.knowledgeId} className="px-3 py-1 bg-green-50 text-green-600 text-sm rounded-full">
                  {k.name}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <Button variant="outline" className="flex-1" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />
          下载
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => setIsEditing(true)}>
          <Pencil className="h-4 w-4 mr-1" />
          编辑
        </Button>
        <Button variant="destructive" className="flex-1" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-1" />
          删除
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Agent员工管理</h1>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            新建员工
          </Button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4 justify-center">
          <Input
            placeholder="搜索员工..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4 mr-2" />
            搜索
          </Button>
        </form>

        <div className="flex-1 overflow-auto">
          {loading && agents.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">加载中...</div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Bot className="w-16 h-16 mb-4 text-gray-300" />
              <p className="mb-2">还没有添加任何员工</p>
              <p className="text-sm">点击上方&quot;新建员工&quot;创建你的第一位 AI 员工</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
              {agents.map((agent) => (
                <Card
                  key={agent.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedAgent?.id === agent.id ? "outline outline-2 outline-blue-500 outline-offset-[-2px] bg-blue-50/30" : ""
                  }`}
                  onClick={() => handleAgentClick(agent)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 mb-3 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                        {agent.avatar ? (
                          <img src={getAvatarFromConfig(agent.avatar)} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <Bot className="w-8 h-8 text-blue-500" />
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1 truncate w-full">{agent.name}</h3>
                      <p className="text-sm text-gray-500 mb-2 line-clamp-2 h-8">{agent.description || "暂无描述"}</p>
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full mb-2 ${
                        agent.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {agent.status === "active" ? "启用" : "停用"}
                      </span>
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

      {(selectedAgent || isCreating) && (
        <Card className="w-[480px] flex-shrink-0 overflow-hidden">
          <CardContent className="p-6 h-full">
            {isEditing || isCreating ? renderCreatePanel() : renderViewPanel()}
          </CardContent>
        </Card>
      )}

      {showCreateSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[480px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">创建新能力</h3>
              <Button size="sm" variant="ghost" onClick={() => { setShowCreateSkill(false); setCreatingSkill({ name: "", description: "", allowedTools: "" }); setCreateError(""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">能力名称 *</label>
                <Input value={creatingSkill.name} onChange={(e) => setCreatingSkill({ ...creatingSkill, name: e.target.value })} placeholder="例如：天气查询" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">能力描述</label>
                <Input value={creatingSkill.description} onChange={(e) => setCreatingSkill({ ...creatingSkill, description: e.target.value })} placeholder="描述这个能力可以做什么" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">可用工具（选填）</label>
                <Input value={creatingSkill.allowedTools} onChange={(e) => setCreatingSkill({ ...creatingSkill, allowedTools: e.target.value })} placeholder="工具1, 工具2, ..." />
              </div>
              {createError && <p className="text-sm text-red-500">{createError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowCreateSkill(false); setCreateError(""); }}>取消</Button>
                <Button className="flex-1" onClick={handleCreateSkill}>创建</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateKnowledge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[600px] max-h-[80vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">创建新知识</h3>
              <Button size="sm" variant="ghost" onClick={() => { setShowCreateKnowledge(false); setCreatingKnowledge({ name: "", description: "", content: "" }); setCreateError(""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">知识名称 *</label>
                <Input value={creatingKnowledge.name} onChange={(e) => setCreatingKnowledge({ ...creatingKnowledge, name: e.target.value })} placeholder="例如：公司产品介绍" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">知识描述</label>
                <Input value={creatingKnowledge.description} onChange={(e) => setCreatingKnowledge({ ...creatingKnowledge, description: e.target.value })} placeholder="描述这个知识的用途" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">知识内容 *</label>
                <textarea
                  className="w-full min-h-[200px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={creatingKnowledge.content}
                  onChange={(e) => setCreatingKnowledge({ ...creatingKnowledge, content: e.target.value })}
                  placeholder="请输入知识的具体内容，支持 Markdown 格式..."
                />
              </div>
              {createError && <p className="text-sm text-red-500">{createError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowCreateKnowledge(false); setCreateError(""); }}>取消</Button>
                <Button className="flex-1" onClick={handleCreateKnowledge}>创建</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}