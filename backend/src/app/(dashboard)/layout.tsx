"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Package, User, Settings, LogOut, Bot, BookOpen, Shield, Upload } from "lucide-react";

const baseNavItems = [
  { href: "/agents", label: "Agent员工", icon: Bot },
  { href: "/skills", label: "能力资产库", icon: Package },
  { href: "/knowledges", label: "知识资源库", icon: BookOpen },
  { href: "/my", label: "我的资源", icon: User },
  { href: "/upload", label: "资源上传", icon: Upload },
];

const adminNavItems = [
  { href: "/admin/skills", label: "能力审核", icon: Shield },
  { href: "/admin/knowledges", label: "知识审核", icon: Shield },
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
      const res = await fetch("/api/auth/session", {
        credentials: "include"
      });
      const data = await res.json();
      if (data.user) {
        setUserInfo(data.user);
        setIsChecking(false);
      } else {
        window.location.href = "/login";
      }
    } catch {
      window.location.href = "/login";
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (e) {
      console.error("Logout error:", e);
    }
    router.push("/login");
  };

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
      <aside className="w-56 border-r bg-white">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">ARM</h1>
          <p className="text-xs text-gray-500">Agent Resource Management</p>
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
          {userInfo?.role === "ADMIN" && (
            <>
              <div className="my-2 border-t" />
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