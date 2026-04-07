"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSSO } from "@/lib/sso-client-react";

export default function LoginPage() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { loginWithSSO, loading: ssoLoading } = useSSO(process.env.NEXT_PUBLIC_SSO_URL || '');

  const handleSSOLogin = () => {
    const redirectUri = `${window.location.origin}/auth/callback`;
    loginWithSSO(redirectUri);
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
        localStorage.setItem("token", data.data.token);
        localStorage.setItem("user", JSON.stringify(data.data.user));
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

  if (ssoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Agent Skill System</CardTitle>
          <CardDescription>选择登录方式</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
