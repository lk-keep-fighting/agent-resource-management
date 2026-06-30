"use client";

import { BookOpen, X } from "lucide-react";
import { KindToggle, type KnowledgeKind } from "./kind-toggle";

export type { KnowledgeKind } from "./kind-toggle";

export interface BoundKnowledge {
  knowledgeId: string;
  name: string;
  description?: string;
  kind: KnowledgeKind;
}

interface BoundKnowledgeListProps {
  items: BoundKnowledge[];
  onRemove: (knowledgeId: string) => void;
  onChangeKind: (knowledgeId: string, kind: KnowledgeKind) => void;
}

export function BoundKnowledgeList({
  items,
  onRemove,
  onChangeKind,
}: BoundKnowledgeListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">暂未绑定知识</p>;
  }
  const essentialCount = items.filter((i) => i.kind === "essential").length;
  const groups: {
    kind: KnowledgeKind;
    label: string;
    hint?: string;
  }[] = [
    {
      kind: "essential",
      label: "必备业务知识（下载到环境）",
      hint:
        essentialCount > 5 ? "必备过多（>5）会拖慢启动" : undefined,
    },
    { kind: "experience", label: "工作经验（按需检索）" },
  ];
  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const groupItems = items.filter((i) => i.kind === g.kind);
        if (groupItems.length === 0) return null;
        const isEssential = g.kind === "essential";
        return (
          <div key={g.kind} className="space-y-2">
            <div
              className={`text-xs font-medium ${
                isEssential ? "text-amber-600" : "text-gray-500"
              }`}
            >
              {g.label}
              {g.hint && <span className="ml-2 text-amber-500">{g.hint}</span>}
            </div>
            {groupItems.map((k) => (
              <div
                key={k.knowledgeId}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  isEssential
                    ? "bg-amber-50 border-amber-200"
                    : "bg-green-50 border-green-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen
                    className={`h-4 w-4 shrink-0 ${
                      isEssential ? "text-amber-500" : "text-green-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{k.name}</div>
                    {k.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {k.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <KindToggle
                    kind={k.kind}
                    onChange={(kind) => onChangeKind(k.knowledgeId, kind)}
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(k.knowledgeId)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
