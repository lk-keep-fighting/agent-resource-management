"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Package, User, Settings, LogOut, Bot, BookOpen, Upload, Shield } from "lucide-react";

const baseNavItems = [
  { href: "/agents", label: "Agent 管理", icon: Bot },
  { href: "/knowledges", label: "知识 市场", icon: BookOpen },
  { href: "/skills", label: "Skill 市场", icon: Package },
  { href: "/my-skills", label: "我的发布", icon: User },
  { href: "/upload", label: "上传", icon: Upload },
  { href: "/settings", label: "设置", icon: Settings },
];

const adminNavItems = [
  { href: "/admin/skills", label: "Skill 管理", icon: Shield },
  { href: "/admin/knowledges", label: "知识 管理", icon: Shield },
];

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const url = new URL(window.location.href);
      const ssoToken = url.searchParams.get("sso_token");

      let endpoint = "/api/auth/session";
      if (ssoToken) {
        endpoint += `?sso_token=${encodeURIComponent(ssoToken)}`;
        url.searchParams.delete("sso_token");
        window.history.replaceState({}, "", url.toString());
      }

      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.user) {
        setUserInfo(data.user);
        setIsChecking(false);
      } else {
        const ssoUrl = process.env.NEXT_PUBLIC_SSO_URL || "http://sso.xuanwu-prod.dev.aimstek.cn";
        const callbackUrl = `${window.location.origin}/api/auth/sso-callback`;
        window.location.href = `${ssoUrl}/login?redirect_uri=${encodeURIComponent(callbackUrl)}`;
      }
    } catch {
      setIsChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error:", e);
    }
    router.push("/login");
  };

  const isAdmin = userInfo?.role === "ADMIN";

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>检查登录状态...</p>
      </div>
    );
  }

  if (!userInfo) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-white">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Agent Skills</h1>
        </div>
        <nav className="p-4 space-y-1">
          {baseNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  pathname === item.href
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  系统管理
                </p>
              </div>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      pathname === item.href
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <div className="absolute bottom-4 left-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}