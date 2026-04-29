"use client";

import { useState, useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { bottts, avataaars, funEmoji, icons, identicon, lorelei } from "@dicebear/collection";
import { RefreshCw, Check } from "lucide-react";

const PRESET_STYLES: Array<{ id: string; name: string; style: any }> = [
  { id: "bottts", name: "机器人", style: bottts },
  { id: "lorelei", name: "自然", style: lorelei },
  { id: "avataaars", name: "卡通", style: avataaars },
  { id: "funEmoji", name: "表情", style: funEmoji },
  { id: "icons", name: "图标", style: icons },
  { id: "identicon", name: "抽象", style: identicon },
];

interface AvatarPickerProps {
  value?: string;
  onChange?: (avatar: string) => void;
  seed?: string;
}

export function AvatarPicker({ value, onChange, seed }: AvatarPickerProps) {
  const [selectedStyle, setSelectedStyle] = useState<string>(PRESET_STYLES[0].id);
  const [currentSeed, setCurrentSeed] = useState(seed || Math.random().toString(36).substring(7));

  const avatarDataUri = useMemo(() => {
    const styleEntry = PRESET_STYLES.find((s) => s.id === selectedStyle);
    if (!styleEntry) return "";
    try {
      return createAvatar(styleEntry.style, {
        seed: currentSeed,
        size: 128,
      }).toDataUri();
    } catch {
      return "";
    }
  }, [selectedStyle, currentSeed]);

  const generateNewSeed = () => {
    const newSeed = Math.random().toString(36).substring(2, 10);
    setCurrentSeed(newSeed);
    if (onChange) {
      onChange(JSON.stringify({ style: selectedStyle, seed: newSeed }));
    }
  };

  const handleStyleChange = (styleId: string) => {
    setSelectedStyle(styleId);
    if (onChange) {
      onChange(JSON.stringify({ style: styleId, seed: currentSeed }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden p-1"
          onClick={generateNewSeed}
          title="点击生成新头像"
        >
          {avatarDataUri ? (
            <img
              src={avatarDataUri}
              alt="Avatar"
              className="w-full h-full object-contain"
            />
          ) : (
            <RefreshCw className="w-6 h-6 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-700 mb-1">
            头像预览
          </div>
          <div className="text-xs text-gray-500">
            点击头像或刷新按钮生成新样式
          </div>
          <button
            type="button"
            onClick={generateNewSeed}
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <RefreshCw className="w-3 h-3" />
            换一换
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">
          选择风格
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => handleStyleChange(style.id)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border transition-colors ${
                selectedStyle === style.id
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {selectedStyle === style.id && (
                <Check className="w-3 h-3" />
              )}
              {style.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function getAvatarFromConfig(config?: string): string {
  if (!config) return "";
  try {
    const { style, seed } = JSON.parse(config);
    const styleEntry = PRESET_STYLES.find((s) => s.id === style);
    if (styleEntry && seed) {
      return createAvatar(styleEntry.style, {
        seed,
        size: 128,
      }).toDataUri();
    }
  } catch {
    return config;
  }
  return "";
}