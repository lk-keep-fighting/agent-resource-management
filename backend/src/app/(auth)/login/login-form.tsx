"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSSO } from "xuanwu-sso-sdk";

const ssoUrl = process.env.NEXT_PUBLIC_SSO_URL || 'http://localhost:3000'

export function LoginForm() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { loginWithSSO } = useSSO(ssoUrl);

  const handleSSOLogin = () => {
    loginWithSSO(`${window.location.origin}/auth/callback`);
  };

  const handleApiKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      const data = await res.json();
      if (data.ok) {
        router.push("/skills");
      } else {
        setError(data.msg || "登录失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleSSOLogin}
        className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90"
        disabled={loading}
      >
        {loading ? "跳转中..." : "单点登录 (SSO)"}
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">或</span>
        </div>
      </div>
      <form onSubmit={handleApiKeyLogin} className="space-y-4">
        <Input
          type="password"
          placeholder="输入 API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="h-11"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? "登录中..." : "使用 API Key 登录"}
        </Button>
      </form>
    </>
  );
}
