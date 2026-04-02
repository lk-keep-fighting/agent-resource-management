"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search } from "lucide-react";

interface Skill {
  id: string;
  name: string;
  description: string;
  license?: string;
  downloadCount: number;
  publishedAt: string;
  publishedBy: string;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const router = useRouter();

  const fetchSkills = async (searchKeyword = "") => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const url = searchKeyword
        ? `/api/v1/skills?keyword=${encodeURIComponent(searchKeyword)}`
        : "/api/v1/skills";

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSkills(data.data.skills);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSkills(keyword);
  };

  const handleDownload = async (name: string) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Skill 市场</h1>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="搜索 Skill..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4 mr-2" />
          搜索
        </Button>
      </form>

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : skills.length === 0 ? (
        <p className="text-gray-500">暂无 Skill</p>
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
                  {skill.license && <span>许可: {skill.license}</span>}
                </div>
                <Button
                  className="w-full mt-4"
                  size="sm"
                  onClick={() => handleDownload(skill.name)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  下载
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}