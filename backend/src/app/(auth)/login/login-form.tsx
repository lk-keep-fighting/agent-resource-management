"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuth2Client } from "xuanwu-sso-sdk";

const ssoUrl = process.env.NEXT_PUBLIC_SSO_URL || 'http://localhost:3000'
const clientId = process.env.NEXT_PUBLIC_SSO_CLIENT_ID || 'agent-skill-system'
const clientSecret = process.env.NEXT_PUBLIC_SSO_CLIENT_SECRET || ''
const redirectUri = typeof window !== 'undefined'
  ? `${window.location.origin}/api/auth/callback`
  : 'http://localhost:3001/api/auth/callback'

const ssoClient = new OAuth2Client({
  clientId,
  clientSecret,
  redirectUri,
  scopes: ['openid', 'profile', 'email'],
}, ssoUrl)

export function LoginForm() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const errorParam = urlParams.get('error')
    if (errorParam) {
      setError(`SSO Error: ${errorParam}`)
      window.history.replaceState({}, '', '/login')
    }
  }, [])

  const handleSSOLogin = async () => {
    setLoading(true)
    setError("")
    try {
      const { url, codeVerifier } = await ssoClient.getAuthorizationUrl()
      document.cookie = `code_verifier=${codeVerifier}; path=/; SameSite=Lax`
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
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
      <Button onClick={handleSSOLogin} className="w-full" variant="default" disabled={loading}>
        {loading ? "跳转中..." : "单点登录"}
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