"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">设置</h1>

      <Card>
        <CardHeader>
          <CardTitle>账户信息</CardTitle>
          <CardDescription>当前登录账户信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">ID:</span>
            <span>{user?.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">名称:</span>
            <span>{user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">邮箱:</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">角色:</span>
            <span className={user?.role === "ADMIN" ? "text-red-600 font-medium" : ""}>
              {user?.role === "ADMIN" ? "管理员" : "普通用户"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">创建时间:</span>
            <span>{user?.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}