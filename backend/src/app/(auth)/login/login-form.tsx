"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Dashboard 登录组件。直接走飞书 OAuth（authorize URL 由服务端 /api/auth/login 构造）。
 *
 * 旧实现里残留的 API Key 表单已经在 auth-redesign 中删除（apiKey 模型已废），
 * 这里只保留「用 ARM 登录」按钮触发飞书授权跳转。
 */
export function LoginForm() {
  // 自动跳转：登录页加载后立刻开始飞书 OAuth 流程
  useEffect(() => {
    const url = new URL(window.location.href);
    const next = url.searchParams.get("next") || "/dashboard";
    window.location.href = `/api/auth/login?next=${encodeURIComponent(next)}`;
  }, []);

  return (
    <div className="space-y-4">
      <Button
        disabled
        className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 opacity-90"
      >
        正在跳转到飞书登录…
      </Button>
    </div>
  );
}