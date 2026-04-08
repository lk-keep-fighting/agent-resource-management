"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, X, Search, Package } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Skill {
  id: string;
  name: string;
  description: string;
  license?: string;
  downloadCount: number;
  publishedAt: string;
  publisherName: string;
  publisherEmail: string;
  tags: string[];
  compatibility?: string;
  allowedTools?: string[];
  content: string | null;
  fileSize: number;
}

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const router = useRouter();

  const fetchSkills = useCallback(async (searchKeyword = "") => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const params = new URLSearchParams();
      if (searchKeyword) params.set("keyword", searchKeyword);
      const queryString = params.toString();
      const url = queryString ? `/api/v1/admin/skills?${queryString}` : "/api/v1/admin/skills";

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSkills(data.data.skills);
      } else if (res.status === 403) {
        alert("无管理员权限");
        router.push("/");
      }
    } catch {
      console.error("Failed to fetch skills");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSkills(keyword);
  };

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除 Skill "${name}" 吗？`)) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/admin/skills/${name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        if (selectedSkillName === name) {
          setSelectedSkillName(null);
          setSelectedSkill(null);
        }
        fetchSkills(keyword);
      } else {
        alert(data.msg || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const handleSkillClick = async (skill: Skill) => {
    if (selectedSkillName === skill.name) {
      setSelectedSkillName(null);
      setSelectedSkill(null);
    } else {
      setSelectedSkillName(skill.name);
      setSelectedSkill(skill);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Skill 管理</h1>
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

      <div className="flex gap-6 h-[calc(100vh-220px)]">
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          <div className="flex-1 overflow-auto border rounded-lg bg-white">
            <table className="w-full">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">名称</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">发布者</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">描述</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">下载量</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">发布时间</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && skills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      加载中...
                    </td>
                  </tr>
                ) : skills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      暂无 Skill
                    </td>
                  </tr>
                ) : (
                  skills.map((skill) => (
                    <tr
                      key={skill.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedSkillName === skill.name ? 'bg-blue-50' : ''}`}
                      onClick={() => handleSkillClick(skill)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-blue-600">{skill.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="font-medium">{skill.publisherName}</div>
                          <div className="text-gray-400 text-xs">{skill.publisherEmail}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-500 max-w-xs truncate">{skill.description}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {skill.downloadCount}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {new Date(skill.publishedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(skill.name);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedSkillName && selectedSkill && (
          <Card className="w-96 flex-shrink-0 overflow-auto">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{selectedSkillName}</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedSkillName(null);
                    setSelectedSkill(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-1">
                {selectedSkill.tags && selectedSkill.tags.length > 0 ? (
                  selectedSkill.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">无标签</span>
                )}
              </div>

              <p className="text-sm text-gray-500">{selectedSkill.description}</p>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">发布者:</div>
                <div>{selectedSkill.publisherName}</div>
                <div className="text-gray-500">下载次数:</div>
                <div>{selectedSkill.downloadCount}</div>
                <div className="text-gray-500">文件大小:</div>
                <div>{(selectedSkill.fileSize / 1024).toFixed(1)} KB</div>
                {selectedSkill.license && (
                  <>
                    <div className="text-gray-500">许可:</div>
                    <div>{selectedSkill.license}</div>
                  </>
                )}
                {selectedSkill.compatibility && (
                  <>
                    <div className="text-gray-500">兼容性:</div>
                    <div>{selectedSkill.compatibility}</div>
                  </>
                )}
              </div>

              {selectedSkill.allowedTools && selectedSkill.allowedTools.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">允许的工具:</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedSkill.allowedTools.map((tool) => (
                      <span
                        key={tool}
                        className="text-xs px-2 py-1 bg-gray-100 rounded"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedSkill.content && (
                <div>
                  <div className="text-sm font-medium mb-2">能力说明:</div>
                  <div className="text-sm prose prose-sm max-w-none border-t pt-2 max-h-48 overflow-auto">
                    <ReactMarkdown>{selectedSkill.content}</ReactMarkdown>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                variant="destructive"
                onClick={() => handleDelete(selectedSkill.name)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除 Skill
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}