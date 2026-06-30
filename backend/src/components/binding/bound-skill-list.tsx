"use client";

import { Sparkles, X } from "lucide-react";

export interface BoundSkill {
  skillId: string;
  skill: { id: string; name: string; description: string };
}

interface BoundSkillListProps {
  items: BoundSkill[];
  onRemove: (skillId: string) => void;
}

export function BoundSkillList({ items, onRemove }: BoundSkillListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">暂未绑定能力</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((s) => (
        <div
          key={s.skillId}
          className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{s.skill.name}</div>
              <div className="text-xs text-gray-500 truncate">
                {s.skill.description}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemove(s.skillId)}
            className="text-gray-400 hover:text-red-500 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
