"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { KeyRound, Mail } from "lucide-react";

type TabKey = "sso" | "password";

interface LoginTabsProps {
  ssoSlot: React.ReactNode;
  passwordSlot: React.ReactNode;
}

const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "sso", label: "单点登录 / API Key", icon: KeyRound },
  { key: "password", label: "邮箱 + 密码", icon: Mail },
];

export function LoginTabs({ ssoSlot, passwordSlot }: LoginTabsProps) {
  const [active, setActive] = useState<TabKey>("sso");

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 mb-4 p-1 bg-slate-100 rounded-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={cn(
                "flex items-center justify-center gap-1.5 text-xs py-2 px-2 rounded-md transition-all",
                selected
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div>{active === "sso" ? ssoSlot : passwordSlot}</div>
    </div>
  );
}
