"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface KnowledgeDetail {
  id: string;
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  creatorName?: string;
}

export default function KnowledgeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [knowledge, setKnowledge] = useState<KnowledgeDetail | null>(null);
  const [user, setUser] = useState<{ role?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
      });
    if (id)
      fetch(`/api/v1/knowledges/${id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setKnowledge(d.data);
        });
  }, [id]);

  if (!knowledge)
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        加载中...
      </div>
    );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/knowledges"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← 返回知识库
          </Link>
          <h1 className="text-2xl font-bold mt-1">{knowledge.name}</h1>
        </div>
        {user?.role === "ADMIN" && (
          <Button
            variant="outline"
            onClick={() => router.push(`/knowledges/${id}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            编辑
          </Button>
        )}
      </div>

      {knowledge.description && (
        <p className="text-gray-600 mb-4">{knowledge.description}</p>
      )}

      {knowledge.tags && knowledge.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {knowledge.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm mb-6 text-gray-500">
        <div>发布人:</div>
        <div>{knowledge.creatorName || "-"}</div>
        <div>创建时间:</div>
        <div>
          {knowledge.createdAt
            ? new Date(knowledge.createdAt).toLocaleDateString()
            : "-"}
        </div>
        <div>更新时间:</div>
        <div>
          {knowledge.updatedAt
            ? new Date(knowledge.updatedAt).toLocaleDateString()
            : "-"}
        </div>
      </div>

      {knowledge.content && (
        <div>
          <div className="text-sm font-medium mb-2">内容</div>
          <div className="text-sm prose prose-sm max-w-none border rounded-md p-4 bg-gray-50">
            <ReactMarkdown>{knowledge.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
