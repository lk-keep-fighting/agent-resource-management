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
