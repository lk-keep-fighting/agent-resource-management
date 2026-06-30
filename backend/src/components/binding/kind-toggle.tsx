"use client";

export type KnowledgeKind = "essential" | "experience";

interface KindToggleProps {
  kind: KnowledgeKind;
  onChange: (kind: KnowledgeKind) => void;
}

export function KindToggle({ kind, onChange }: KindToggleProps) {
  const isEssential = kind === "essential";
  return (
    <button
      type="button"
      onClick={() => onChange(isEssential ? "experience" : "essential")}
      className={`text-xs px-2 py-1 rounded border transition-colors ${
        isEssential
          ? "border-amber-300 text-amber-700 hover:bg-amber-100"
          : "border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
      title={isEssential ? "点击改为工作经验" : "点击改为必备业务知识"}
    >
      {isEssential ? "必备" : "经验"}
    </button>
  );
}
