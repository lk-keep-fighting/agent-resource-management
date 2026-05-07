"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagFilter, SelectedTagsDisplay } from "@/components/ui/tag-filter";
import { Search, X, Edit, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Knowledge {
  id: string;
  name: string;
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  content?: string;
  tags?: string[];
  creatorName?: string;
}

interface AgentSummary {
  agentId: string;
  agentName: string;
  agentVersion: string;
  agentDescription?: string;
  retrievalConfig?: {
    topK?: number;
    similarityThreshold?: number;
  };
}

interface Tag {
  id: string;
  name: string;
  skillCount?: number;
  knowledgeCount?: number;
}

export default function KnowledgesPage() {
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"and" | "or">("or");
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [knowledgeDetailCache, setKnowledgeDetailCache] = useState<Record<string, Knowledge>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [user, setUser] = useState<{ role?: string } | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", content: "", tags: [] as string[] });
  const [editSaving, setEditSaving] = useState(false);

  const [linkedAgents, setLinkedAgents] = useState<AgentSummary[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionUpdating, setVersionUpdating] = useState(false);

  const router = useRouter();

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/v1/tags");
      const data = await res.json();
      if (data.ok) {
        setTags(data.data);
      }
    } catch {
      console.error("Failed to fetch tags");
    }
  };

  const fetchKnowledges = useCallback(async (
    searchKeyword: string = keyword,
    tagsToFilter: string[] = selectedTags,
    mode: "and" | "or" = tagMode
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchKeyword) params.set("search", searchKeyword);
      if (tagsToFilter.length > 0) {
        params.set("tags", tagsToFilter.join(","));
        params.set("tagMode", mode);
      }
      const queryString = params.toString();
      const url = queryString ? `/api/v1/knowledges?${queryString}` : "/api/v1/knowledges";

      const res = await fetch(url, {});
      const data = await res.json();
      if (data.ok) {
        setKnowledges(data.data.knowledges);
      }
    } catch {
      console.error("Failed to fetch knowledges");
    } finally {
      setLoading(false);
    }
  }, [router, keyword, selectedTags, tagMode]);

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
    fetch("/api/auth/session", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        }
      });
  }, []);

  const fetchLinkedAgents = useCallback(async (knowledgeId: string) => {
    try {
      const res = await fetch(`/api/v1/knowledges/${knowledgeId}/agents`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setLinkedAgents(data.data);
      } else {
        setLinkedAgents([]);
      }
    } catch {
      console.error("Failed to fetch linked agents");
      setLinkedAgents([]);
    }
  }, []);

  useEffect(() => {
    fetchTags();
    fetchKnowledges();
  }, []);

  useEffect(() => {
    if (selectedKnowledgeId) {
      fetchKnowledgeDetail(selectedKnowledgeId);
    }
  }, [selectedKnowledgeId, fetchKnowledgeDetail]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchKnowledges(keyword, selectedTags, tagMode);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [selectedTags, tagMode, keyword]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchKnowledges(keyword, selectedTags, tagMode);
  };

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const handleTagModeChange = (mode: "and" | "or") => {
    setTagMode(mode);
  };

  const handleTagRemove = (tag: string) => {
    const newTags = selectedTags.filter((t) => t !== tag);
    handleTagsChange(newTags);
  };

  const handleKnowledgeClick = (knowledge: Knowledge) => {
    if (selectedKnowledgeId === knowledge.id) {
      setSelectedKnowledgeId(null);
    } else {
      setSelectedKnowledgeId(knowledge.id);
    }
  };

  const selectedKnowledge = selectedKnowledgeId ? knowledgeDetailCache[selectedKnowledgeId] : null;

  const handleEditClick = () => {
    if (selectedKnowledge) {
      setEditForm({
        name: selectedKnowledge.name || "",
        description: selectedKnowledge.description || "",
        content: selectedKnowledge.content || "",
        tags: selectedKnowledge.tags || [],
      });
      setEditModalOpen(true);
    }
  };

  const handleEditSave = async () => {
    if (!selectedKnowledgeId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/v1/knowledges/${selectedKnowledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          content: editForm.content,
          tags: editForm.tags,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setKnowledgeDetailCache((prev) => ({
          ...prev,
          [selectedKnowledgeId]: { ...prev[selectedKnowledgeId], ...editForm, updatedAt: new Date().toISOString() },
        }));
        setKnowledges((prev) =>
          prev.map((k) =>
            k.id === selectedKnowledgeId ? { ...k, ...editForm, updatedAt: new Date().toISOString() } : k
          )
        );
        setEditModalOpen(false);

        if (linkedAgents.length > 0) {
          setSelectedAgentIds(linkedAgents.map((a) => a.agentId));
          setVersionModalOpen(true);
          fetchLinkedAgents(selectedKnowledgeId);
        }
      } else {
        alert(data.message || "保存失败");
      }
    } catch {
      console.error("Failed to save knowledge");
      alert("保存失败");
    } finally {
      setEditSaving(false);
    }
  };

  const handleVersionUpdate = async () => {
    if (selectedAgentIds.length === 0) {
      setVersionModalOpen(false);
      return;
    }
    setVersionUpdating(true);
    try {
      const res = await fetch("/api/v1/agents/batch-version", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentIds: selectedAgentIds,
          knowledgeId: selectedKnowledgeId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert(`已更新 ${data.data.updatedAgents.length} 个Agent版本`);
      } else {
        alert(data.message || "版本更新失败");
      }
    } catch {
      console.error("Failed to update agent versions");
      alert("版本更新失败");
    } finally {
      setVersionUpdating(false);
      setVersionModalOpen(false);
    }
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

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

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-3 items-center">
            <TagFilter
              tags={tags}
              selectedTags={selectedTags}
              tagMode={tagMode}
              onTagsChange={handleTagsChange}
              onTagModeChange={handleTagModeChange}
              placeholder="标签筛选"
              immediate={true}
            />
            <SelectedTagsDisplay tags={selectedTags} onRemove={handleTagRemove} />
          </div>
        )}

        <div className="flex-1 overflow-auto border rounded-lg bg-white">
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">标签</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">发布人</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">更新时间</th>
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
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedKnowledgeId === knowledge.id ? "bg-blue-50" : ""}`}
                    onClick={() => handleKnowledgeClick(knowledge)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600">{knowledge.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-500 max-w-xs truncate">{knowledge.description || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {knowledge.tags && knowledge.tags.length > 0 ? (
                          knowledge.tags.map((tag) => (
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
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {knowledge.creatorName || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {knowledge.updatedAt ? new Date(knowledge.updatedAt).toLocaleDateString() : "-"}
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
              <CardTitle className="text-lg">{selectedKnowledge?.name || ""}</CardTitle>
              <div className="flex items-center gap-1">
                {user?.role === "ADMIN" && (
                  <Button size="sm" variant="ghost" onClick={handleEditClick}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedKnowledgeId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
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

                {selectedKnowledge.tags && selectedKnowledge.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedKnowledge.tags.map((tag) => (
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
                  <div className="text-gray-500">创建时间:</div>
                  <div>{selectedKnowledge.createdAt ? new Date(selectedKnowledge.createdAt).toLocaleDateString() : "-"}</div>
                  <div className="text-gray-500">更新时间:</div>
                  <div>{selectedKnowledge.updatedAt ? new Date(selectedKnowledge.updatedAt).toLocaleDateString() : "-"}</div>
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

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>编辑知识</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">名称</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="请输入知识名称"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">描述</label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="请输入描述"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">标签 (逗号分隔)</label>
              <Input
                value={editForm.tags.join(", ")}
                onChange={(e) => setEditForm((prev) => ({
                  ...prev,
                  tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                }))}
                placeholder="例如: python, api, 机器学习"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">内容</label>
              <textarea
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={editForm.content}
                onChange={(e) => setEditForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="请输入知识内容 (支持 Markdown)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              <Save className="h-4 w-4 mr-2" />
              {editSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionModalOpen} onOpenChange={setVersionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>更新关联Agent版本</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500 mb-4">
              此知识已关联以下Agent，编辑后是否更新它们的版本号？
            </p>
            {linkedAgents.length === 0 ? (
              <p className="text-sm text-gray-400">暂无关联的Agent</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto">
                {linkedAgents.map((agent) => (
                  <label
                    key={agent.agentId}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAgentIds.includes(agent.agentId)}
                      onChange={() => toggleAgentSelection(agent.agentId)}
                      className="rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{agent.agentName}</div>
                      <div className="text-xs text-gray-500">
                        当前版本: {agent.agentVersion}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionModalOpen(false)} disabled={versionUpdating}>
              跳过
            </Button>
            <Button onClick={handleVersionUpdate} disabled={versionUpdating}>
              {versionUpdating ? "更新中..." : "确认更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}