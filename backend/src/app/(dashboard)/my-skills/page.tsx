"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Skill {
  id: string;
  name: string;
  description: string;
  license?: string;
  downloadCount: number;
  publishedAt: string;
  tags: string[];
}

interface SkillDetail extends Skill {
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  fileSize: number;
  fileHash: string;
  content: string | null;
}

export default function MySkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [skillDetailCache, setSkillDetailCache] = useState<Record<string, SkillDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const router = useRouter();

  const fetchSkills = useCallback(async () => {
    setLoading(true);
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
  }, [router]);

  const fetchSkillDetail = useCallback(async (name: string) => {
    if (skillDetailCache[name]) {
      return;
    }
    setDetailLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/skills/${name}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSkillDetailCache((prev) => ({ ...prev, [name]: data.data }));
      }
    } catch {
      console.error("Failed to fetch skill detail");
    } finally {
      setDetailLoading(false);
    }
  }, [skillDetailCache]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  useEffect(() => {
    if (selectedSkillName) {
      fetchSkillDetail(selectedSkillName);
    }
  }, [selectedSkillName, fetchSkillDetail]);

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
        if (selectedSkillName === name) {
          setSelectedSkillName(null);
        }
        fetchSkills();
      } else {
        alert(data.msg || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
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

  const handleSkillClick = (skill: Skill) => {
    if (selectedSkillName === skill.name) {
      setSelectedSkillName(null);
    } else {
      setSelectedSkillName(skill.name);
    }
  };

  const selectedSkill = selectedSkillName ? skillDetailCache[selectedSkillName] : null;

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">我的发布</h1>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg bg-white">
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">标签</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">下载量</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">发布时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && skills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : skills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    暂无发布的 Skill
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
                      <div className="text-sm text-gray-500 max-w-xs truncate">{skill.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {skill.tags && skill.tags.length > 0 ? (
                          skill.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {skill.downloadCount}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {new Date(skill.publishedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSkillName && (
        <Card className="w-96 flex-shrink-0 overflow-auto">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{selectedSkillName}</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedSkillName(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailLoading && !selectedSkill ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : selectedSkill ? (
              <>
                <p className="text-sm text-gray-500">{selectedSkill.description}</p>

                {selectedSkill.tags && selectedSkill.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedSkill.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500">文件大小:</div>
                  <div>{(selectedSkill.fileSize / 1024).toFixed(1)} KB</div>
                  <div className="text-gray-500">下载次数:</div>
                  <div>{selectedSkill.downloadCount}</div>
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
                    <div className="text-sm prose prose-sm max-w-none border-t pt-2">
                      <ReactMarkdown>{selectedSkill.content}</ReactMarkdown>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleDownload(selectedSkill.name)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    下载
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => handleDelete(selectedSkill.name)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
