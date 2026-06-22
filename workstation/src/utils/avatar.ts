import { createAvatar } from "@dicebear/core";
import {
  bottts,
  avataaars,
  funEmoji,
  icons,
  identicon,
  lorelei,
} from "@dicebear/collection";

export const AVATAR_STYLES: Record<string, any> = {
  bottts,
  lorelei,
  avataaars,
  funEmoji,
  icons,
  identicon,
};

export const AVATAR_STYLE_LABELS: Record<string, string> = {
  bottts: "机器人",
  lorelei: "自然",
  avataaars: "卡通",
  funEmoji: "表情",
  icons: "图标",
  identicon: "抽象",
};

interface ParsedAvatar {
  style: string;
  seed: string;
}

/**
 * 解析 ARM avatar 字段。
 *
 * ARM 的 avatar 字段有三种可能：
 * 1. JSON 字符串 `{"style":"bottts","seed":"abc"}`  → DiceBear 生成
 * 2. 单个 emoji 字符串 `"🤖"`                          → 原样使用
 * 3. URL `"https://..."` 或 data URI                 → 原样使用
 *
 * 返回标准化结果：
 * - kind: "dicebear" | "emoji" | "image"
 * - display: 可直接放入 <img src> 或文本节点的字符串
 */
export function normalizeAvatar(raw: string | undefined | null): {
  kind: "dicebear" | "emoji" | "image";
  display: string;
  raw: string;
} {
  const fallback = {
    kind: "emoji" as const,
    display: "🤖",
    raw: "🤖",
  };
  if (!raw || !raw.trim()) return fallback;

  // 1) JSON dicebear 配置
  if (raw.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Partial<ParsedAvatar>;
      if (parsed.style && parsed.seed && AVATAR_STYLES[parsed.style]) {
        const uri = createAvatar(AVATAR_STYLES[parsed.style], {
          seed: String(parsed.seed),
          size: 128,
        }).toDataUri();
        return { kind: "dicebear", display: uri, raw };
      }
    } catch {
      /* fallthrough */
    }
    return fallback;
  }

  // 2) URL 或 data URI
  if (/^(https?:|data:)/i.test(raw)) {
    return { kind: "image", display: raw, raw };
  }

  // 3) emoji / 文本
  return { kind: "emoji", display: raw, raw };
}