"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSSOLogin = () => {
    const ssoUrl = process.env.NEXT_PUBLIC_SSO_URL || 'http://sso.xuanwu-prod.dev.aimstek.cn';
    const redirectUri = `${window.location.origin}/api/auth/sso-callback`;
    window.location.href = `${ssoUrl}/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
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
      <Button onClick={handleSSOLogin} className="w-full" variant="default">
        单点登录
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">或</span>
        </div>
      </div>
      <form onSubmit={handleApiKeyLogin} className="space-y-4">
        <Input
          type="password"
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "登录中..." : "API Key 登录"}
        </Button>
      </form>
    </>
  );
}