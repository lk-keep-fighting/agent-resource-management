"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Tag {
  id: string;
  name: string;
  skillCount?: number;
  knowledgeCount?: number;
}

interface TagFilterProps {
  tags: Tag[];
  selectedTags: string[];
  tagMode: "and" | "or";
  onTagsChange: (tags: string[]) => void;
  onTagModeChange: (mode: "and" | "or") => void;
  placeholder?: string;
  immediate?: boolean;
}

export function TagFilter({
  tags,
  selectedTags,
  tagMode,
  onTagsChange,
  onTagModeChange,
  placeholder = "选择标签",
  immediate = false,
}: TagFilterProps) {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [localSelectedTags, setLocalSelectedTags] = React.useState<string[]>([]);
  const [localTagMode, setLocalTagMode] = React.useState<"and" | "or">("or");

  React.useEffect(() => {
    if (open) {
      setLocalSelectedTags(selectedTags);
      setLocalTagMode(tagMode);
    }
  }, [open, selectedTags, tagMode]);

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTag = (tagName: string) => {
    const newTags = localSelectedTags.includes(tagName)
      ? localSelectedTags.filter((t) => t !== tagName)
      : [...localSelectedTags, tagName];

    setLocalSelectedTags(newTags);

    if (immediate) {
      onTagsChange(newTags);
    }
  };

  const handleModeChange = (mode: "and" | "or") => {
    setLocalTagMode(mode);
    if (immediate) {
      onTagModeChange(mode);
    }
  };

  const clearAll = () => {
    setLocalSelectedTags([]);
    if (immediate) {
      onTagsChange([]);
    }
  };

  const handleConfirm = () => {
    if (!immediate) {
      onTagsChange(localSelectedTags);
      onTagModeChange(localTagMode);
    }
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="outline" className="gap-2">
          {placeholder}
          {selectedTags.length > 0 && (
            <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-xs">
              {selectedTags.length}
            </span>
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-50 w-80 p-3 bg-white rounded-lg shadow-lg border"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索标签..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
              />
            </div>

            <div className="max-h-48 overflow-auto space-y-1">
              {filteredTags.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">
                  未找到标签
                </p>
              ) : (
                filteredTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <CheckboxPrimitive.Root
                      checked={localSelectedTags.includes(tag.name)}
                      onCheckedChange={() => toggleTag(tag.name)}
                      className="h-4 w-4 rounded border border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 flex items-center justify-center"
                    >
                      <CheckboxPrimitive.Indicator>
                        <Check className="h-3 w-3 text-white" />
                      </CheckboxPrimitive.Indicator>
                    </CheckboxPrimitive.Root>
                    <span className="flex-1 text-sm">{tag.name}</span>
                    <span className="text-xs text-gray-400">
                      {(tag.skillCount || 0) + (tag.knowledgeCount || 0)}
                    </span>
                  </label>
                ))
              )}
            </div>

            <SeparatorPrimitive.Root className="h-px bg-gray-200" />

            <div className="flex gap-2 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="tagMode"
                  checked={localTagMode === "or"}
                  onChange={() => handleModeChange("or")}
                  className="h-3 w-3"
                />
                满足任一
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="tagMode"
                  checked={localTagMode === "and"}
                  onChange={() => handleModeChange("and")}
                  className="h-3 w-3"
                />
                满足所有
              </label>
            </div>

            <SeparatorPrimitive.Root className="h-px bg-gray-200" />

            <div className="flex justify-between">
              <Button
                size="sm"
                variant="ghost"
                onClick={clearAll}
                disabled={localSelectedTags.length === 0}
                className="gap-1"
              >
                <X className="h-3 w-3" />
                清除
              </Button>
              <Button size="sm" onClick={handleConfirm}>
                {immediate ? "关闭" : "确定"}
              </Button>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

interface SelectedTagsDisplayProps {
  tags: string[];
  onRemove: (tag: string) => void;
}

export function SelectedTagsDisplay({ tags, onRemove }: SelectedTagsDisplayProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs"
        >
          {tag}
          <button
            onClick={() => onRemove(tag)}
            className="hover:bg-blue-100 rounded-full p-0.5"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}