"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, Package, BookOpen, Network, ArrowRight, Users, Brain, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Stats {
  agents: number;
  skills: number;
  knowledges: number;
  downloads: number;
}

const armModules = [
  {
    icon: Bot,
    title: "Agent 工厂",
    description: "创建、配置和管理你的数字员工团队",
    href: "/agents",
    color: "blue",
  },
  {
    icon: Package,
    title: "能力资产库",
    description: "Skill 市场 - 浏览、获取和发布能力模块",
    href: "/skills",
    color: "green",
  },
  {
    icon: BookOpen,
    title: "知识资源库",
    description: "管理和组织专业知识，为 Agent 赋能",
    href: "/knowledges",
    color: "purple",
  },
  {
    icon: Network,
    title: "资源编排",
    description: "多 Agent 协作与任务调度中心",
    href: "/orchestration",
    color: "orange",
  },
];

const statsConfig = [
  { label: "Agent 总数", key: "agents" as const, icon: Bot, color: "text-blue-600" },
  { label: "能力资产", key: "skills" as const, icon: Package, color: "text-green-600" },
  { label: "知识条目", key: "knowledges" as const, icon: BookOpen, color: "text-purple-600" },
  { label: "资源调用", key: "downloads" as const, icon: Zap, color: "text-orange-600" },
];

const hrmMapping = [
  { arm: "Agent", hrm: "员工", desc: "数字化的AI工作者" },
  { arm: "Skill", hrm: "能力/技能", desc: "可复用的专业能力资产" },
  { arm: "Knowledge", hrm: "知识", desc: "专业领域知识库" },
  { arm: "Orchestration", hrm: "协作/调度", desc: "多智能体协同工作" },
];

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ agents: 0, skills: 0, knowledges: 0, downloads: 0 });

  useEffect(() => {
    fetch("/api/v1/stats")
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.data) {
          setStats(data.data);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ARM</h1>
              <p className="text-xs text-gray-500">Agent Resource Management</p>
            </div>
          </div>
          <Button onClick={() => router.push("/login")}>
            登录系统
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-6">
            <Users className="h-4 w-4" />
            借鉴人力资源管理思想
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            数字化人力资源管理系统
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            将 AI Agent 视为数字员工，对 Skill、Knowledge 等资源进行全生命周期管理，
            实现资源的获取、配置、调度与绩效评估
          </p>
          <Button size="lg" onClick={() => router.push("/agents")}>
            进入管理控制台 <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-12">
          {statsConfig.map((config) => {
            const Icon = config.icon;
            return (
              <Card key={config.label} className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats[config.key]}</p>
                      <p className="text-sm text-gray-500">{config.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mb-12">
          <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">核心模块</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {armModules.map((module) => {
              const Icon = module.icon;
              const colorClasses = {
                blue: "bg-blue-50 text-blue-600",
                green: "bg-green-50 text-green-600",
                purple: "bg-purple-50 text-purple-600",
                orange: "bg-orange-50 text-orange-600",
              };
              return (
                <Card
                  key={module.title}
                  className="bg-white hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(module.href)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className={`h-12 w-12 rounded-lg ${colorClasses[module.color as keyof typeof colorClasses]} flex items-center justify-center`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-lg mb-1">{module.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {module.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="bg-white mb-12">
          <CardHeader>
            <CardTitle className="text-lg">ARM vs 人力资源管理 对照表</CardTitle>
            <CardDescription>
              借鉴 HRM 思想，重新定义 Agent 资源管理体系
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {hrmMapping.map((item) => (
                <div key={item.arm} className="p-4 bg-slate-50 rounded-lg">
                  <div className="font-bold text-gray-900 mb-1">{item.arm}</div>
                  <div className="text-blue-600 font-medium text-sm mb-1">≈ {item.hrm}</div>
                  <div className="text-gray-500 text-xs">{item.desc}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-4">准备好开始了吗？</h3>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            登录系统，开始管理你的数字员工团队，构建高效的 Agent 资源体系
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => router.push("/login")}
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            前往登录
          </Button>
        </div>
      </main>

      <footer className="border-t bg-white mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-gray-500 text-sm">
          <p>Agent Resource Management (ARM)</p>
          <p className="text-xs mt-1">借鉴人力资源管理思想的 Agent 资源管理系统</p>
        </div>
      </footer>
    </div>
  );
}