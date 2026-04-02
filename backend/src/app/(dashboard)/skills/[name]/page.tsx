"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Skill {
  id: string;
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  fileSize: number;
  downloadCount: number;
  publishedAt: string;
}

export default function SkillDetailPage() {
  const params = useParams();
  const name = params.name as string;
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchSkill = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        const res = await fetch(`/api/v1/skills/${name}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.ok) {
          setSkill(data.data);
        } else {
          router.push("/skills");
        }
      } catch {
        router.push("/skills");
      } finally {
        setLoading(false);
      }
    };

    fetchSkill();
  }, [name, router]);

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/skills/${name}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.zip`;
      a.click();
    } catch {
      alert("下载失败");
    }
  };

  if (loading) {
    return <p className="text-gray-500">加载中...</p>;
  }

  if (!skill) {
    return <p className="text-gray-500">Skill 不存在</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/skills" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4 mr-1" />
        返回列表
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{skill.name}</CardTitle>
          <CardDescription>{skill.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">文件大小:</span> {skill.fileSize} bytes
            </div>
            <div>
              <span className="text-gray-500">下载次数:</span> {skill.downloadCount}
            </div>
            {skill.license && (
              <div>
                <span className="text-gray-500">许可:</span> {skill.license}
              </div>
            )}
            {skill.compatibility && (
              <div>
                <span className="text-gray-500">兼容性:</span> {skill.compatibility}
              </div>
            )}
          </div>

          {skill.allowedTools && skill.allowedTools.length > 0 && (
            <div>
              <span className="text-sm text-gray-500">允许的工具:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {skill.allowedTools.map((tool) => (
                  <span
                    key={tool}
                    className="px-2 py-1 bg-gray-100 rounded text-xs"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button className="w-full" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            下载 Skill
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}