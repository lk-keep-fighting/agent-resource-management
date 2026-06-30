"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PickerItem {
  id: string;
  name: string;
  description?: string;
}

interface ResourcePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: PickerItem[];
  searchResults?: PickerItem[] | null;
  onSearch?: (keyword: string) => void;
  excludedIds?: string[];
  onConfirm: (ids: string[]) => void;
  createHref?: string;
  createLabel?: string;
}

export function ResourcePickerDialog({
  open,
  onOpenChange,
  title,
  items,
  searchResults,
  onSearch,
  excludedIds = [],
  onConfirm,
  createHref,
  createLabel,
}: ResourcePickerDialogProps) {
  const [keyword, setKeyword] = useState("");
  const [checked, setChecked] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setKeyword("");
      setChecked([]);
    }
  }, [open]);

  const handleSearchChange = (v: string) => {
    setKeyword(v);
    onSearch?.(v);
  };

  const base = (searchResults ?? items).filter(
    (i) => !excludedIds.includes(i.id)
  );
  const filtered = searchResults
    ? base
    : base.filter(
        (i) =>
          !keyword.trim() ||
          i.name.toLowerCase().includes(keyword.toLowerCase()) ||
          (i.description?.toLowerCase().includes(keyword.toLowerCase()) ??
            false)
      );

  const toggle = (id: string) => {
    setChecked((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : [...c, id]
    );
  };

  const handleConfirm = () => {
    onConfirm(checked);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索..."
            value={keyword}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex-1 overflow-auto space-y-2 min-h-[200px]">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">无匹配项</p>
          ) : (
            filtered.map((item) => {
              const isChecked = checked.includes(item.id);
              return (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(item.id)}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>
        {createHref && (
          <a
            href={createHref}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            {createLabel ?? "没有？新建 →"}
          </a>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={checked.length === 0}>
            添加{checked.length > 0 ? ` ${checked.length} 项` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
