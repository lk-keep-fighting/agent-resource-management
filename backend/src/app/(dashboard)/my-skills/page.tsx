"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";

interface Skill {
  id: string;
  name: string;
  description: string;
  license?: string;
  downloadCount: number;
  publishedAt: string;
}

export default function MySkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchSkills = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/v1/users/me/skills", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSkills(data.data);
      }
    } catch {
      console.error("Failed to fetch skills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除 ${name} 吗？`)) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/skills/${name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        fetchSkills();
      } else {
        alert(data.msg || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的发布</h1>
      </div>

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : skills.length === 0 ? (
        <p className="text-gray-500">暂无发布的 Skill</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <Card key={skill.id}>
              <CardHeader>
                <CardTitle className="text-lg">{skill.name}</CardTitle>
                <CardDescription>{skill.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>下载: {skill.downloadCount}</span>
                  <span>{new Date(skill.publishedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    className="flex-1"
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/skills/${skill.name}`)}
                  >
                    查看
                  </Button>
                  <Button
                    className="flex-1"
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(skill.name)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}