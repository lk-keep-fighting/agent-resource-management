"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SourceFormDialog } from "@/components/knowledge-source/source-form-dialog";
import {
  Plus,
  Search,
  TestTube,
  Trash2,
  Edit,
  X,
  ExternalLink,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface ExternalSource {
  id: string;
  name: string;
  description?: string;
  status: string;
  endpoint: string;
  authType: string;
  authHeader?: string;
  authValue?: string;
  idField: string;
  titleField: string;
  contentField: string;
  descField?: string;
  updatedField?: string;
  contentType: string;
  method: string;
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export default function AdminKnowledgeSourcesPage() {
  const [sources, setSources] = useState<ExternalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<ExternalSource | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const router = useRouter();

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/knowledge-sources");
      const data = await res.json();
      if (data.ok) {
        setSources(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch sources:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const filteredSources = sources.filter((source) => {
    const matchesKeyword =
      !keyword ||
      source.name.toLowerCase().includes(keyword.toLowerCase()) ||
      source.endpoint.toLowerCase().includes(keyword.toLowerCase());
    const matchesStatus = statusFilter === "all" || source.status === statusFilter;
    return matchesKeyword && matchesStatus;
  });

  const handleEdit = (source: ExternalSource) => {
    setEditingSource(source);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个外部知识源配置吗？")) return;

    try {
      const res = await fetch(`/api/v1/knowledge-sources/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        fetchSources();
      } else {
        alert(data.msg || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const handleTest = async (source: ExternalSource) => {
    setTestingId(source.id);
    setTestResults((prev) => ({ ...prev, [source.id]: { success: false, message: "测试中..." } }));

    try {
      const res = await fetch(`/api/v1/knowledge-sources/${source.id}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok && data.data.success) {
        setTestResults((prev) => ({
          ...prev,
          [source.id]: { success: true, message: data.data.message || "连接成功" },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [source.id]: { success: false, message: data.msg || data.data?.message || "测试失败" },
        }));
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [source.id]: { success: false, message: err.message || "测试失败" },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleStatusChange = async (source: ExternalSource, newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/knowledge-sources/${source.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchSources();
      } else {
        alert(data.msg || "更新失败");
      }
    } catch {
      alert("更新失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">外部知识源</h1>
        <Button
          onClick={() => {
            setEditingSource(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          添加知识源
        </Button>
      </div>

      <div className="flex gap-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <Input
            placeholder="搜索名称或端点..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4 mr-2" />
            搜索
          </Button>
        </form>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">启用</SelectItem>
            <SelectItem value="paused">暂停</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {loading && sources.length === 0 ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : filteredSources.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {keyword || statusFilter !== "all"
              ? "没有匹配的知识源"
              : "暂无配置的外部知识源"}
          </div>
        ) : (
          filteredSources.map((source) => (
            <Card key={source.id} className={source.status === "paused" ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{source.name}</CardTitle>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        source.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {source.status === "active" ? "启用" : "暂停"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={source.status}
                      onValueChange={(value: string) => handleStatusChange(source, value)}
                    >
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">启用</SelectItem>
                        <SelectItem value="paused">暂停</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(source)}
                      disabled={testingId === source.id}
                    >
                      {testingId === source.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(source)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(source.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {source.description && (
                  <p className="text-sm text-gray-500">{source.description}</p>
                )}

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ExternalLink className="h-3 w-3" />
                  <span className="font-mono text-xs">{source.endpoint}</span>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>
                    认证:{" "}
                    <span className="font-medium">
                      {source.authType === "none"
                        ? "无"
                        : source.authType === "api_key"
                        ? `API Key (${source.authHeader})`
                        : source.authType === "bearer"
                        ? "Bearer Token"
                        : "Basic Auth"}
                    </span>
                  </span>
                  <span>
                    字段映射:{" "}
                    <span className="font-mono">
                      id={source.idField}, title={source.titleField}, content={source.contentField}
                    </span>
                  </span>
                  <span>
                    内容类型:{" "}
                    <span className="font-medium">
                      {source.contentType === "markdown"
                        ? "Markdown"
                        : source.contentType === "html"
                        ? "HTML"
                        : "纯文本"}
                    </span>
                  </span>
                  <span>HTTP {source.method}</span>
                </div>

                {testResults[source.id] && (
                  <div
                    className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                      testResults[source.id].success
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {testResults[source.id].success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {testResults[source.id].message}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <SourceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingSource(null);
          }
        }}
        onSuccess={fetchSources}
        editingSource={editingSource}
      />
    </div>
  );
}
