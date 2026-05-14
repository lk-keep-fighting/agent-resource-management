"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft } from "lucide-react";

interface Knowledge {
  id: string;
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export default function KnowledgeSharePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchKnowledge() {
      try {
        const res = await fetch(`/api/v1/knowledges/${id}`);
        const data = await res.json();
        if (data.ok && data.data) {
          setKnowledge(data.data);
        } else {
          setError("知识不存在或已被删除");
        }
      } catch {
        setError("加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchKnowledge();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !knowledge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-300 mb-4">404</h1>
          <p className="text-gray-500 mb-6">{error || "知识不存在"}</p>
          <Link
            href="/knowledges"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            返回知识市场
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/knowledges"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回知识市场
        </Link>

        <article className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
          <header className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              {knowledge.name}
            </h1>

            {knowledge.description && (
              <p className="text-gray-500 mb-4">{knowledge.description}</p>
            )}

            {knowledge.tags && knowledge.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {knowledge.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
              {knowledge.createdAt && (
                <span>
                  发布于 {new Date(knowledge.createdAt).toLocaleDateString("zh-CN")}
                </span>
              )}
            </div>
          </header>

          <div className="border-t pt-8">
            {knowledge.content ? (
              <div className="markdown-content">
                <ReactMarkdown>{knowledge.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">暂无内容</p>
            )}
          </div>
        </article>

        <footer className="text-center mt-8 text-sm text-gray-400">
          由 ARM 知识市场分享
        </footer>
      </div>
    </div>
  );
}
