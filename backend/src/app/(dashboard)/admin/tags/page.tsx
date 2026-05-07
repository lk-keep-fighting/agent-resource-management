"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, RefreshCw } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  skillCount: number;
  knowledgeCount: number;
  createdAt: string;
}

export default function TagsAdminPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/tags");
      const data = await res.json();
      if (data.ok) {
        setTags(data.data);
      }
    } catch {
      console.error("Failed to fetch tags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewTagName("");
        fetchTags();
      } else {
        alert(data.message || "创建失败");
      }
    } catch {
      alert("创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!deleteTagId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/tags/${deleteTagId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        setDeleteTagId(null);
        fetchTags();
      } else {
        alert(data.message || "删除失败");
      }
    } catch {
      alert("删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const totalSkillCount = tags.reduce((sum, t) => sum + t.skillCount, 0);
  const totalKnowledgeCount = tags.reduce((sum, t) => sum + t.knowledgeCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">标签管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {tags.length} 个标签，关联 {totalSkillCount} 个 Skills，{totalKnowledgeCount} 个 Knowledges
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTags} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">创建标签</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="输入标签名称..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
              maxLength={50}
              className="max-w-xs"
            />
            <Button onClick={handleCreateTag} disabled={creating || !newTagName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              {creating ? "创建中..." : "创建"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">标签列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && tags.length === 0 ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无标签</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">标签名称</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Skills</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Knowledges</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">创建时间</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tags.map((tag) => (
                    <tr key={tag.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-sm">
                          {tag.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {tag.skillCount}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {tag.knowledgeCount}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">
                        {new Date(tag.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTagId(tag.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTagId} onOpenChange={() => setDeleteTagId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除标签</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              确定要删除标签 &quot;{tags.find((t) => t.id === deleteTagId)?.name}&quot; 吗？
            </p>
            <p className="text-sm text-gray-500 mt-2">
              此操作将同时移除该标签与所有 Skills 和 Knowledges 的关联。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTagId(null)} disabled={deleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteTag} disabled={deleting}>
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}