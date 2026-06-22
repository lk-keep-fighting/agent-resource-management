"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseTokenFromCallback } from "xuanwu-sso-sdk";

export const dynamic = "force-dynamic";

/**
 * ARM SSO 回调页面（client-side 渲染）
 *
 * 真 SSO 服务（xuanwu-sso-sdk v1.0.5）跳回时给 `?sso_token=<jwt>` 参数。
 * 默认行为：写 cookie + 跳 /agents（ARM dashboard）。
 * 带 `?next=<url>` 时：把 {token, user} 编码到 `<next>#sso=...` 跳回。
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>处理登录中...</p></div>}>
      <AuthCallback />
    </Suspense>
  );
}

function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const handle = async () => {
      const token = parseTokenFromCallback(window.location.href);
      const next = searchParams.get("next");

      if (!token) {
        setStatus("error");
        setError("未获取到登录凭证");
        setTimeout(() => router.push("/login?error=no_token"), 1000);
        return;
      }

      // 默认：写 cookie + 跳 /agents
      if (!next) {
        document.cookie = `access_token=${token}; path=/; SameSite=Lax; max-age=3600`;
        router.push("/agents");
        return;
      }

      // 带 next：验证 token 拿 user → 编码到 <next>#sso=... 跳回
      try {
        // 不能浏览器直调 SSO /api/auth/userinfo（CORS），走后端 /api/auth/verify
        const verifyRes = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.valid || !verifyData.user) {
          const errUrl = `${next}?error=invalid_token`;
          window.location.href = errUrl;
          return;
        }

        const payload = encodeURIComponent(
          JSON.stringify({
            token,
            user: {
              id: verifyData.user.id,
              name: verifyData.user.name ?? null,
              email: verifyData.user.email ?? null,
              role: verifyData.user.role ?? "USER",
            },
          })
        );
        window.location.href = `${next}#sso=${payload}`;
      } catch (err) {
        console.error("[auth/callback] next jump failed:", err);
        const errUrl = `${next}?error=callback_failed`;
        window.location.href = errUrl;
      }
    };

    handle();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {status === "processing" ? (
        <p>处理登录中...</p>
      ) : (
        <div className="text-red-500">
          <p>登录失败：{error}</p>
          <p className="text-sm text-gray-500 mt-2">即将跳转到登录页...</p>
        </div>
      )}
    </div>
  );
}
