"use client";

import ReactMarkdown from "react-markdown";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "支持 Markdown 格式...",
  minHeight = 320,
}: MarkdownEditorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">编辑</div>
        <textarea
          className="w-full border rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ minHeight }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">预览</div>
        <div
          className="border rounded-md p-3 text-sm prose prose-sm max-w-none overflow-auto bg-gray-50"
          style={{ minHeight }}
        >
          {value ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <span className="text-gray-400">预览区</span>
          )}
        </div>
      </div>
    </div>
  );
}
