"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseTokenFromCallback } from "xuanwu-sso-sdk";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const token = parseTokenFromCallback(window.location.href);
    if (token) {
      document.cookie = `access_token=${token}; path=/; SameSite=Lax; max-age=3600`;
      router.push("/skills");
    } else {
      router.push("/login?error=callback_failed");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>处理登录中...</p>
    </div>
  );
}
