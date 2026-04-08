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
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token) {
      router.push("/login");
    } else if (userStr) {
      try {
        const user = JSON.parse(userStr) as UserInfo;
        setUserInfo(user);
      } catch {
        fetchUserInfo(token);
      }
      setIsChecking(false);
    } else {
      fetchUserInfo(token);
    }
  }, [router]);

  const fetchUserInfo = async (token: string) => {
    try {
      const res = await fetch("/api/auth/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok && data.data) {
        const user = data.data as UserInfo;
        setUserInfo(user);
        localStorage.setItem("user", JSON.stringify(user));
      }
    } catch {
      console.error("Failed to fetch user info");
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
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