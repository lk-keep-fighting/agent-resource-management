"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Knowledge {
  id: string;
  name: string;
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  content?: string;
}

export default function KnowledgesPage() {
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [knowledgeDetailCache, setKnowledgeDetailCache] = useState<Record<string, Knowledge>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const router = useRouter();

  const fetchKnowledges = useCallback(async (searchKeyword = "") => {
    setLoading(true);
    try {
      // Auth handled by cookie (API reads from cookie)

      const params = new URLSearchParams();
      if (searchKeyword) params.set("keyword", searchKeyword);
      const queryString = params.toString();
      const url = queryString ? `/api/v1/knowledges?${queryString}` : "/api/v1/knowledges";

      const res = await fetch(url, {
        // Auth via cookie
        });
      const data = await res.json();
      if (data.ok) {
        setKnowledges(data.data.knowledges);
      }
    } catch {
      console.error("Failed to fetch knowledges");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchKnowledgeDetail = useCallback(async (id: string) => {
    if (knowledgeDetailCache[id]) {
      return;
    }
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/v1/knowledges/${id}`);
      const data = await res.json();
      if (data.ok && data.data) {
        setKnowledgeDetailCache((prev) => ({ ...prev, [id]: data.data }));
      }
    } catch {
      console.error("Failed to fetch knowledge detail");
    } finally {
      setDetailLoading(false);
    }
  }, [knowledgeDetailCache]);

  useEffect(() => {
    fetchKnowledges();
  }, [fetchKnowledges]);

  useEffect(() => {
    if (selectedKnowledgeId) {
      fetchKnowledgeDetail(selectedKnowledgeId);
    }
  }, [selectedKnowledgeId, fetchKnowledgeDetail]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchKnowledges(keyword);
  };

  const handleKnowledgeClick = (knowledge: Knowledge) => {
    if (selectedKnowledgeId === knowledge.id) {
      setSelectedKnowledgeId(null);
    } else {
      setSelectedKnowledgeId(knowledge.id);
    }
  };

  const selectedKnowledge = selectedKnowledgeId ? knowledgeDetailCache[selectedKnowledgeId] : null;

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">知识 市场</h1>
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

        <div className="flex-1 overflow-auto border rounded-lg bg-white">
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && knowledges.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : knowledges.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
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
                      <div className="text-sm text-gray-500 max-w-xs truncate">{knowledge.description || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {knowledge.updatedAt ? new Date(knowledge.updatedAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedKnowledgeId && (
        <Card className="w-96 flex-shrink-0 overflow-auto">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{selectedKnowledge?.name || ''}</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedKnowledgeId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailLoading && !selectedKnowledge ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : selectedKnowledge ? (
              <>
                {selectedKnowledge.description && (
                  <p className="text-sm text-gray-500">{selectedKnowledge.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500">创建时间:</div>
                  <div>{selectedKnowledge.createdAt ? new Date(selectedKnowledge.createdAt).toLocaleDateString() : '-'}</div>
                  <div className="text-gray-500">更新时间:</div>
                  <div>{selectedKnowledge.updatedAt ? new Date(selectedKnowledge.updatedAt).toLocaleDateString() : '-'}</div>
                </div>

                {selectedKnowledge.content && (
                  <div>
                    <div className="text-sm font-medium mb-2">内容:</div>
                    <div className="text-sm prose prose-sm max-w-none border-t pt-2">
                      <ReactMarkdown>{selectedKnowledge.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
