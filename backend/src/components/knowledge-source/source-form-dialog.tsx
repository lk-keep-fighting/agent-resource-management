"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, TestTube, AlertCircle, CheckCircle } from "lucide-react";

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
}

interface SourceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingSource?: ExternalSource | null;
}

const AUTH_TYPES = [
  { value: "none", label: "无认证" },
  { value: "api_key", label: "API Key" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
];

const CONTENT_TYPES = [
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "plain_text", label: "纯文本" },
];

export function SourceFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editingSource,
}: SourceFormProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    endpoint: "",
    authType: "none",
    authHeader: "X-API-Key",
    authValue: "",
    idField: "id",
    titleField: "title",
    contentField: "content",
    descField: "",
    updatedField: "",
    contentType: "markdown",
    method: "GET",
  });

  const [sampleJson, setSampleJson] = useState("");
  const [detectedFields, setDetectedFields] = useState<string[]>([]);

  useEffect(() => {
    if (editingSource) {
      setFormData({
        name: editingSource.name,
        description: editingSource.description || "",
        endpoint: editingSource.endpoint,
        authType: editingSource.authType,
        authHeader: editingSource.authHeader || "X-API-Key",
        authValue: editingSource.authValue || "",
        idField: editingSource.idField,
        titleField: editingSource.titleField,
        contentField: editingSource.contentField,
        descField: editingSource.descField || "",
        updatedField: editingSource.updatedField || "",
        contentType: editingSource.contentType,
        method: editingSource.method,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        endpoint: "",
        authType: "none",
        authHeader: "X-API-Key",
        authValue: "",
        idField: "id",
        titleField: "title",
        contentField: "content",
        descField: "",
        updatedField: "",
        contentType: "markdown",
        method: "GET",
      });
    }
    setTestResult(null);
    setSampleJson("");
    setDetectedFields([]);
  }, [editingSource, open]);

  const handleSampleJsonChange = (value: string) => {
    setSampleJson(value);
    if (!value.trim()) {
      setDetectedFields([]);
      return;
    }
    try {
      const parsed = JSON.parse(value);
      const sampleItem = Array.isArray(parsed)
        ? parsed[0]
        : parsed.knowledge || parsed.documents || parsed.items || parsed;
      if (sampleItem && typeof sampleItem === "object") {
        const fields = Object.keys(sampleItem);
        setDetectedFields(fields);
      }
    } catch {
      setDetectedFields([]);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/knowledge-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ success: true, message: "配置成功" });
      } else {
        setTestResult({ success: false, message: data.msg || "测试失败" });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "测试失败" });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTestResult(null);
    try {
      const url = editingSource
        ? `/api/v1/knowledge-sources/${editingSource.id}`
        : "/api/v1/knowledge-sources";
      const method = editingSource ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ok) {
        onSuccess();
        onOpenChange(false);
      } else {
        setTestResult({ success: false, message: data.msg || "保存失败" });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "保存失败" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingSource ? "编辑外部知识源" : "添加外部知识源"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">配置名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="如：产品知识库"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endpoint">API 端点 *</Label>
                <Input
                  id="endpoint"
                  value={formData.endpoint}
                  onChange={(e) =>
                    setFormData({ ...formData, endpoint: e.target.value })
                  }
                  placeholder="https://api.example.com/knowledge"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="可选描述信息"
              />
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700">认证配置</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>认证方式</Label>
                <Select
                  value={formData.authType}
                  onValueChange={(value: string) =>
                    setFormData({ ...formData, authType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.authType === "api_key" && (
                <>
                  <div className="space-y-2">
                    <Label>Header 名称</Label>
                    <Input
                      value={formData.authHeader}
                      onChange={(e) =>
                        setFormData({ ...formData, authHeader: e.target.value })
                      }
                      placeholder="X-API-Key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={formData.authValue}
                      onChange={(e) =>
                        setFormData({ ...formData, authValue: e.target.value })
                      }
                      placeholder="输入 API Key"
                    />
                  </div>
                </>
              )}
              {formData.authType === "bearer" && (
                <div className="space-y-2">
                  <Label>Token</Label>
                  <Input
                    type="password"
                    value={formData.authValue}
                    onChange={(e) =>
                      setFormData({ ...formData, authValue: e.target.value })
                    }
                    placeholder="Bearer Token"
                  />
                </div>
              )}
              {formData.authType === "basic" && (
                <div className="space-y-2">
                  <Label>Base64 凭证</Label>
                  <Input
                    type="password"
                    value={formData.authValue}
                    onChange={(e) =>
                      setFormData({ ...formData, authValue: e.target.value })
                    }
                    placeholder="Base64(user:password)"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700">格式配置</h3>

            <div className="space-y-2">
              <Label>响应示例（粘贴 JSON 自动检测字段）</Label>
              <textarea
                className="w-full h-24 p-3 text-sm border rounded-md font-mono"
                value={sampleJson}
                onChange={(e) => handleSampleJsonChange(e.target.value)}
                placeholder={'示例：\n{\n  "id": "001",\n  "title": "文档标题",\n  "body": "正文内容"\n}'}
              />
              {detectedFields.length > 0 && (
                <p className="text-xs text-green-600">
                  检测到字段: {detectedFields.join(", ")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>唯一标识字段</Label>
                <Input
                  value={formData.idField}
                  onChange={(e) =>
                    setFormData({ ...formData, idField: e.target.value })
                  }
                  placeholder="id"
                />
              </div>
              <div className="space-y-2">
                <Label>标题字段</Label>
                <Input
                  value={formData.titleField}
                  onChange={(e) =>
                    setFormData({ ...formData, titleField: e.target.value })
                  }
                  placeholder="title"
                />
              </div>
              <div className="space-y-2">
                <Label>内容字段</Label>
                <Input
                  value={formData.contentField}
                  onChange={(e) =>
                    setFormData({ ...formData, contentField: e.target.value })
                  }
                  placeholder="content"
                />
              </div>
              <div className="space-y-2">
                <Label>描述字段</Label>
                <Input
                  value={formData.descField}
                  onChange={(e) =>
                    setFormData({ ...formData, descField: e.target.value })
                  }
                  placeholder="description（可选）"
                />
              </div>
              <div className="space-y-2">
                <Label>更新时间字段</Label>
                <Input
                  value={formData.updatedField}
                  onChange={(e) =>
                    setFormData({ ...formData, updatedField: e.target.value })
                  }
                  placeholder="updatedAt（可选）"
                />
              </div>
              <div className="space-y-2">
                <Label>内容类型</Label>
                <Select
                  value={formData.contentType}
                  onValueChange={(value: string) =>
                    setFormData({ ...formData, contentType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md ${
                testResult.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing || !formData.endpoint}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              测试连接
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "保存中..." : editingSource ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
