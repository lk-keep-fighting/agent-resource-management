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
