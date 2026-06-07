"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSession } from "@/lib/session";
import { Mail, Lock, User as UserIcon } from "lucide-react";

type Mode = "login" | "register";

export function EmailPasswordForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "register") {
        const res = await fetch("/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: name || undefined }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.msg || "注册失败");
          return;
        }
        saveSession({ token: data.data.token, user: data.data.user });
        router.push("/skills");
        return;
      }

      const res = await fetch("/api/v1/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.msg || "登录失败");
        return;
      }
      saveSession({ token: data.data.token, user: data.data.user });
      router.push("/skills");
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {mode === "register" && (
        <div className="space-y-1.5">
          <Label htmlFor="ep-name">昵称（可选）</Label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="ep-name"
              type="text"
              placeholder="昵称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 pl-9"
              autoComplete="nickname"
            />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="ep-email">邮箱</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="ep-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 pl-9"
            required
            autoComplete="email"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ep-password">密码</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="ep-password"
            type="password"
            placeholder="至少 8 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 pl-9"
            required
            minLength={8}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full h-10" disabled={loading}>
        {loading
          ? mode === "login"
            ? "登录中..."
            : "注册中..."
          : mode === "login"
            ? "登录"
            : "注册并登录"}
      </Button>
      <p className="text-center text-xs text-gray-500">
        {mode === "login" ? (
          <>
            还没有账号？
            <button
              type="button"
              className="ml-1 text-blue-600 hover:underline"
              onClick={() => switchMode("register")}
            >
              立即注册
            </button>
          </>
        ) : (
          <>
            已有账号？
            <button
              type="button"
              className="ml-1 text-blue-600 hover:underline"
              onClick={() => switchMode("login")}
            >
              去登录
            </button>
          </>
        )}
      </p>
    </form>
  );
}
