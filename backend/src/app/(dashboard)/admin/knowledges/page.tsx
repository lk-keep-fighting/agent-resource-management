"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, X, Search, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Knowledge {
  id: string;
  name: string;
  description?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  creatorName: string;
  creatorEmail: string;
}

export default function AdminKnowledgesPage() {
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState<Knowledge | null>(null);
  const router = useRouter();

  const fetchKnowledges = useCallback(async (searchKeyword = "") => {
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
      const url = queryString ? `/api/v1/admin/knowledges?${queryString}` : "/api/v1/admin/knowledges";

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setKnowledges(data.data.knowledges);
      } else if (res.status === 403) {
        alert("无管理员权限");
        router.push("/");
      }
    } catch {
      console.error("Failed to fetch knowledges");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchKnowledges(keyword);
  };

  useEffect(() => {
    fetchKnowledges();
  }, [fetchKnowledges]);

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个知识吗？")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/admin/knowledges/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        if (selectedKnowledgeId === id) {
          setSelectedKnowledgeId(null);
          setSelectedKnowledge(null);
        }
        fetchKnowledges(keyword);
      } else {
        alert(data.msg || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const handleKnowledgeClick = (knowledge: Knowledge) => {
    if (selectedKnowledgeId === knowledge.id) {
      setSelectedKnowledgeId(null);
      setSelectedKnowledge(null);
    } else {
      setSelectedKnowledgeId(knowledge.id);
      setSelectedKnowledge(knowledge);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">知识 管理</h1>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="搜索知识..."
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">创建者</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">描述</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">创建时间</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && knowledges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      加载中...
                    </td>
                  </tr>
                ) : knowledges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      暂无知识
                    </td>
                  </tr>
                ) : (
                  knowledges.map((knowledge) => (
                    <tr
                      key={knowledge.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedKnowledgeId === knowledge.id ? 'bg-blue-50' : ''}`}
                      onClick={() => handleKnowledgeClick(knowledge)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-blue-600">{knowledge.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="font-medium">{knowledge.creatorName}</div>
                          <div className="text-gray-400 text-xs">{knowledge.creatorEmail}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-500 max-w-xs truncate">
                          {knowledge.description || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {new Date(knowledge.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(knowledge.id);
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

        {selectedKnowledgeId && selectedKnowledge && (
          <Card className="w-96 flex-shrink-0 overflow-auto">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{selectedKnowledge.name}</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedKnowledgeId(null);
                    setSelectedKnowledge(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedKnowledge.description && (
                <p className="text-sm text-gray-500">{selectedKnowledge.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">创建者:</div>
                <div>{selectedKnowledge.creatorName}</div>
                <div className="text-gray-500">创建时间:</div>
                <div>{new Date(selectedKnowledge.createdAt).toLocaleDateString()}</div>
                <div className="text-gray-500">更新时间:</div>
                <div>{new Date(selectedKnowledge.updatedAt).toLocaleDateString()}</div>
              </div>

              {selectedKnowledge.content && (
                <div>
                  <div className="text-sm font-medium mb-2">内容:</div>
                  <div className="text-sm prose prose-sm max-w-none border-t pt-2 max-h-64 overflow-auto">
                    <ReactMarkdown>{selectedKnowledge.content}</ReactMarkdown>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                variant="destructive"
                onClick={() => handleDelete(selectedKnowledge.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除知识
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}