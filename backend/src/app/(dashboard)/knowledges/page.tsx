"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ListPageHeader } from "@/components/ui/list-page-header";
import {
  TagFilter,
  SelectedTagsDisplay,
} from "@/components/ui/tag-filter";
import { BookOpen } from "lucide-react";

interface Knowledge {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  updatedAt?: string;
  creatorName?: string;
}
interface Tag {
  id: string;
  name: string;
  knowledgeCount?: number;
}

export default function KnowledgesPage() {
  const router = useRouter();
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"and" | "or">("or");
  const [user, setUser] = useState<{ role?: string } | null>(null);

  const fetchTags = () =>
    fetch("/api/v1/tags")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setTags(d.data);
      });

  const fetchKnowledges = useCallback(
    (q: string, tagsFilter: string[], mode: "and" | "or") => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (tagsFilter.length > 0) {
        params.set("tags", tagsFilter.join(","));
        params.set("tagMode", mode);
      }
      const url = params.toString()
        ? `/api/v1/knowledges?${params.toString()}`
        : "/api/v1/knowledges";
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setKnowledges(d.data.knowledges);
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
      });
    fetchTags();
    fetchKnowledges("", [], "or");
  }, [fetchKnowledges]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchKnowledges(keyword, selectedTags, tagMode);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [keyword, selectedTags, tagMode, fetchKnowledges]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <ListPageHeader
        title="知识资源库"
        keyword={keyword}
        onKeywordChange={setKeyword}
        onCreate={
          user?.role === "ADMIN"
            ? () => router.push("/knowledges/new")
            : undefined
        }
        createLabel="新建知识"
      >
        {tags.length > 0 && (
          <div className="flex items-center gap-2">
            <TagFilter
              tags={tags}
              selectedTags={selectedTags}
              tagMode={tagMode}
              onTagsChange={setSelectedTags}
              onTagModeChange={setTagMode}
              placeholder="标签筛选"
              immediate={true}
            />
            <SelectedTagsDisplay
              tags={selectedTags}
              onRemove={(t) =>
                setSelectedTags(selectedTags.filter((x) => x !== t))
              }
            />
          </div>
        )}
      </ListPageHeader>

      <div className="flex-1 overflow-auto">
        {loading && knowledges.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            加载中...
          </div>
        ) : knowledges.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <BookOpen className="w-16 h-16 mb-4 text-gray-300" />
            <p className="mb-2">暂无知识</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
            {knowledges.map((k) => (
              <Card
                key={k.id}
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => router.push(`/knowledges/${k.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <BookOpen className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <h3 className="font-semibold text-gray-900 truncate">
                      {k.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 h-10 mb-2">
                    {k.description || "暂无描述"}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-2 min-h-[20px]">
                    {(k.tags || []).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{k.creatorName || "-"}</span>
                    <span>
                      {k.updatedAt
                        ? new Date(k.updatedAt).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
