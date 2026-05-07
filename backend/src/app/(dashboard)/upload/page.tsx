"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Package, BookOpen, FileText, CheckCircle2, XCircle } from "lucide-react";

type TabType = "skill" | "knowledge";

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<TabType>("skill");
  const [skillFile, setSkillFile] = useState<File | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState("");
  const [skillSuccess, setSkillSuccess] = useState("");

  const [knowledgeName, setKnowledgeName] = useState("");
  const [knowledgeDesc, setKnowledgeDesc] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [knowledgeTags, setKnowledgeTags] = useState("");
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState("");
  const [knowledgeSuccess, setKnowledgeSuccess] = useState("");
  const router = useRouter();

  const handleSkillUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillFile) return;

    setSkillLoading(true);
    setSkillError("");
    setSkillSuccess("");

    try {
      // Auth handled by cookie (API reads from cookie)

      const formData = new FormData();
      formData.append("file", skillFile);

      const res = await fetch("/api/v1/skills", {
        method: "POST",
        // Auth via cookie
        body: formData,
      });

      const data = await res.json();
      if (data.ok) {
        setSkillSuccess("Skill 上传成功!");
        setSkillFile(null);
        setTimeout(() => router.push("/my-skills"), 1500);
      } else {
        setSkillError(data.msg || "上传失败");
      }
    } catch {
      setSkillError("网络错误");
    } finally {
      setSkillLoading(false);
    }
  };

  const handleKnowledgeUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowledgeName.trim()) {
      setKnowledgeError("请输入知识名称");
      return;
    }

    setKnowledgeLoading(true);
    setKnowledgeError("");
    setKnowledgeSuccess("");

    try {
      // Auth handled by cookie (API reads from cookie)

      const res = await fetch("/api/v1/knowledges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: knowledgeName.trim(),
          description: knowledgeDesc.trim(),
          content: knowledgeContent.trim(),
          tags: knowledgeTags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setKnowledgeSuccess("知识创建成功!");
        setKnowledgeName("");
        setKnowledgeDesc("");
        setKnowledgeContent("");
        setKnowledgeTags("");
        setTimeout(() => router.push("/knowledges"), 1500);
      } else {
        setKnowledgeError(data.msg || "创建失败");
      }
    } catch {
      setKnowledgeError("网络错误");
    } finally {
      setKnowledgeLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">上传</h1>

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("skill")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "skill"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          上传 Skill
        </button>
        <button
          onClick={() => setActiveTab("knowledge")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "knowledge"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          上传知识
        </button>
      </div>

      {activeTab === "skill" && (
        <Card>
          <CardHeader>
            <CardTitle>上传 Skill</CardTitle>
            <CardDescription>上传 Skill ZIP 包进行发布，支持 adk skill 格式</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSkillUpload} className="space-y-4">
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-300 transition-colors">
                <Input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setSkillFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="skill-file-input"
                />
                <label
                  htmlFor="skill-file-input"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="text-sm text-gray-600">
                    {skillFile ? (
                      <span className="font-medium text-blue-600">{skillFile.name}</span>
                    ) : (
                      <>
                        <span className="font-medium text-blue-600">点击上传</span> 或拖拽文件
                      </>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">支持 .zip 格式</div>
                </label>
              </div>

              {skillFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span>{skillFile.name}</span>
                  <span className="text-gray-400">({(skillFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}

              {skillError && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <XCircle className="h-4 w-4" />
                  {skillError}
                </div>
              )}
              {skillSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <CheckCircle2 className="h-4 w-4" />
                  {skillSuccess}
                </div>
              )}

              <Button type="submit" disabled={skillLoading || !skillFile}>
                <Upload className="h-4 w-4 mr-2" />
                {skillLoading ? "上传中..." : "发布 Skill"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "knowledge" && (
        <Card>
          <CardHeader>
            <CardTitle>创建知识</CardTitle>
            <CardDescription>填写知识信息，支持 Markdown 格式内容</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleKnowledgeUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">名称</label>
                <Input
                  placeholder="输入知识名称"
                  value={knowledgeName}
                  onChange={(e) => setKnowledgeName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">描述</label>
                <Input
                  placeholder="简要描述知识内容（可选）"
                  value={knowledgeDesc}
                  onChange={(e) => setKnowledgeDesc(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">内容</label>
                <textarea
                  className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="输入知识内容，支持 Markdown 格式&#10;&#10;例如：&#10;# 标题&#10;这是一段描述..."
                  value={knowledgeContent}
                  onChange={(e) => setKnowledgeContent(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">标签</label>
                <Input
                  placeholder="输入标签，逗号分隔，例如：api, python, 机器学习"
                  value={knowledgeTags}
                  onChange={(e) => setKnowledgeTags(e.target.value)}
                />
                <p className="text-xs text-gray-400">多个标签用逗号分隔</p>
              </div>

              {knowledgeError && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <XCircle className="h-4 w-4" />
                  {knowledgeError}
                </div>
              )}
              {knowledgeSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <CheckCircle2 className="h-4 w-4" />
                  {knowledgeSuccess}
                </div>
              )}

              <Button type="submit" disabled={knowledgeLoading || !knowledgeName.trim()}>
                <Upload className="h-4 w-4 mr-2" />
                {knowledgeLoading ? "创建中..." : "创建知识"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}