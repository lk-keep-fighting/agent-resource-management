"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Package, Users, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Bot,
    title: "Agent 管理",
    description: "创建和管理你的 AI Agent，配置技能和知识库",
  },
  {
    icon: Package,
    title: "Skill 市场",
    description: "浏览和下载社区分享的各种技能扩展",
  },
  {
    icon: Users,
    title: "我的发布",
    description: "发布你开发的技能，与社区共享",
  },
  {
    icon: Zap,
    title: "知识库增强",
    description: "为 Agent 添加专业知识，提升回答准确度",
  },
];

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const ssoToken = searchParams.get("sso_token");
    if (ssoToken) {
      setIsLoading(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("sso_token");
      window.history.replaceState({}, "", url.toString());

      fetch(`/api/auth/session?sso_token=${encodeURIComponent(ssoToken)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            router.push("/skills");
          } else {
            router.push("/login");
          }
        })
        .catch(() => {
          router.push("/login");
        });
    }
  }, [searchParams, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
        <p>正在登录...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Agent Skill System</h1>
          <Button onClick={() => router.push("/login")}>
            登录
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            AI Agent 技能管理系统
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            为你的 AI Agent 管理和扩展技能，构建更强大的智能助手
          </p>
          <Button size="lg" onClick={() => router.push("/login")}>
            开始使用 <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="bg-white">
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="bg-white rounded-xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">准备好开始了吗？</h3>
          <p className="text-gray-600 mb-6">
            输入你的 API Key 即可登录系统，开始管理你的 Agent 技能
          </p>
          <Button size="lg" onClick={() => router.push("/login")}>
            前往登录
          </Button>
        </div>
      </main>

      <footer className="border-t bg-white mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-gray-500 text-sm">
          Agent Skill System
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
        <p>加载中...</p>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}