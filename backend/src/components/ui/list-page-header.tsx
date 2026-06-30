"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

interface ListPageHeaderProps {
  title: string;
  keyword: string;
  onKeywordChange: (v: string) => void;
  onSearchSubmit?: () => void;
  onCreate?: () => void;
  createLabel?: string;
  children?: React.ReactNode;
}

export function ListPageHeader({
  title,
  keyword,
  onKeywordChange,
  onCreate,
  createLabel = "新建",
  children,
}: ListPageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索..."
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
        {children}
        {onCreate && (
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {createLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
