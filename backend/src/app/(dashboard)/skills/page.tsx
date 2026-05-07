"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagFilter, SelectedTagsDisplay } from "@/components/ui/tag-filter";
import { Download, Search, X, ArrowUp, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Skill {
  id: string;
  name: string;
  description: string;
  license?: string;
  downloadCount: number;
  publishedAt: string;
  updatedAt: string;
  publishedBy: string;
  publisherName?: string;
  tags: string[];
}

interface SkillDetail extends Skill {
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  fileSize: number;
  fileHash: string;
  content: string | null;
  publishedByUser?: { id: string; name: string };
}

interface Tag {
  id: string;
  name: string;
  skillCount: number;
  knowledgeCount?: number;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"and" | "or">("or");
  const [sortBy, setSortBy] = useState<string>("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [skillDetailCache, setSkillDetailCache] = useState<Record<string, SkillDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
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

  const fetchSkills = useCallback(async (
    searchKeyword: string = keyword,
    tagsToFilter: string[] = selectedTags,
    mode: "and" | "or" = tagMode,
    currentSortBy: string = sortBy,
    currentSortOrder: "asc" | "desc" = sortOrder
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchKeyword) params.set("keyword", searchKeyword);
      if (tagsToFilter.length > 0) {
        params.set("tags", tagsToFilter.join(","));
        params.set("tagMode", mode);
      }
      params.set("sortBy", currentSortBy);
      params.set("sortOrder", currentSortOrder);
      const queryString = params.toString();
      const url = queryString ? `/api/v1/skills?${queryString}` : "/api/v1/skills";

      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setSkills(data.data.skills);
      }
    } catch {
      console.error("Failed to fetch skills");
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedTags, tagMode, sortBy, sortOrder]);

  const fetchSkillDetail = useCallback(async (name: string) => {
    if (skillDetailCache[name]) {
      return;
    }
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/v1/skills/${name}`);
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
    fetchTags();
    fetchSkills();
  }, []);

  useEffect(() => {
    if (selectedSkillName) {
      fetchSkillDetail(selectedSkillName);
    }
  }, [selectedSkillName, fetchSkillDetail]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchSkills(keyword, selectedTags, tagMode, sortBy, sortOrder);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [selectedTags, tagMode, keyword, sortBy, sortOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSkills(keyword, selectedTags, tagMode, sortBy, sortOrder);
  };

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const handleTagModeChange = (mode: "and" | "or") => {
    setTagMode(mode);
  };

  const handleTagRemove = (tag: string) => {
    const newTags = selectedTags.filter((t) => t !== tag);
    setSelectedTags(newTags);
  };

  const handleSkillClick = (skill: Skill) => {
    if (selectedSkillName === skill.name) {
      setSelectedSkillName(null);
    } else {
      setSelectedSkillName(skill.name);
    }
  };

  const handleDownload = async (name: string) => {
    try {
      const res = await fetch(`/api/v1/skills/${name}/download`);
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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const selectedSkill = selectedSkillName ? skillDetailCache[selectedSkillName] : null;

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
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
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    名称
                    {sortBy === "name" && (sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">标签</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">发布人</th>
                <th
                  className="px-4 py-3 text-right text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("downloadCount")}
                >
                  <div className="flex items-center justify-end gap-1">
                    下载量
                    {sortBy === "downloadCount" && (sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("updatedAt")}
                >
                  <div className="flex items-center justify-end gap-1">
                    修改时间
                    {sortBy === "updatedAt" && (sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </div>
                </th>
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
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {skill.publisherName || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {skill.downloadCount}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {new Date(skill.updatedAt).toLocaleDateString()}
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

                <Button
                  className="w-full"
                  onClick={() => handleDownload(selectedSkill.name)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  下载 Skill
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}